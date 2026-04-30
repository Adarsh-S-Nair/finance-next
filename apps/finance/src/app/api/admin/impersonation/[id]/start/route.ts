import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../../../lib/api/withAuth";
import { isCallerAdmin } from "../../../../../../lib/api/admin";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

/**
 * Admin clicks "Enter session" → finance creates an impersonation_sessions
 * row (intent token, consumed_at = null) and generates a one-time Supabase
 * magic link for the target user. The admin's browser opens the action_link
 * in a new tab; Supabase verifies + mints a session as the target, then
 * redirects through `/auth/callback?next=/impersonation/begin?session=<id>`
 * which sets the impersonator cookie and lands on the dashboard.
 *
 * The session_id is the row's uuid, which is hard to guess and only valid
 * once (we set consumed_at on /api/impersonation/begin so a leaked URL
 * can't be replayed).
 */
export const POST = withAuth<{ id: string }>(
  "admin:impersonation:start",
  async (req: NextRequest, callerId, { params }) => {
    if (!(await isCallerAdmin(callerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: grantId } = await params;
    if (!grantId) {
      return NextResponse.json({ error: "Missing grant id" }, { status: 400 });
    }

    const { data: grant, error: fetchErr } = await supabaseAdmin
      .from("impersonation_grants")
      .select("id, status, expires_at, requester_id, target_user_id")
      .eq("id", grantId)
      .single();

    if (fetchErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }
    if (grant.requester_id !== callerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (grant.status !== "approved") {
      return NextResponse.json({ error: `Grant is ${grant.status}` }, { status: 400 });
    }
    // null expires_at = indefinite grant; only block if the grant has a
    // concrete expiry that's already passed.
    if (grant.expires_at && new Date(grant.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Grant has expired" }, { status: 400 });
    }

    const { data: targetData, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(
      grant.target_user_id,
    );
    if (targetErr || !targetData?.user?.email) {
      return NextResponse.json({ error: "Target user has no email" }, { status: 400 });
    }
    const targetEmail = targetData.user.email;

    // Create the intent token first so its id can be embedded in the
    // magic-link redirect.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("impersonation_sessions")
      .insert({
        grant_id: grant.id,
        target_user_id: grant.target_user_id,
        requester_id: callerId,
        ip,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (sessionErr || !session) {
      console.error("[admin:impersonation:start] session insert failed", sessionErr);
      return NextResponse.json({ error: "Could not start session" }, { status: 500 });
    }

    // The host the admin's browser landed on — used so dev can hit
    // localhost and prod can hit www.zervo.app without env juggling.
    const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
      `/impersonation/begin?session=${session.id}`,
    )}`;

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: { redirectTo },
      });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[admin:impersonation:start] generateLink failed", linkErr);
      // Drop the dangling session row so it doesn't appear in audit as a
      // mystery never-consumed entry.
      await supabaseAdmin.from("impersonation_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: "Could not generate magic link" }, { status: 500 });
    }

    return NextResponse.json({
      session_id: session.id,
      action_link: linkData.properties.action_link,
    });
  },
);
