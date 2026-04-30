import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import {
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_COOKIE_OPTIONS,
} from "../../../../lib/impersonation/cookie";

/**
 * After the magic-link callback exchanges a Supabase session for the target
 * user, the client is bounced to `/impersonation/begin?session=<id>` which
 * POSTs here. We validate the session row, mark it consumed, and set the
 * impersonator cookie so subsequent server reads can flag this browser
 * tab as "currently impersonating."
 *
 * The bearer token must belong to the target user (the magic link just
 * minted that session) — anyone else is rejected. Without that check a
 * leaked session_id could be used by anyone who happens to be logged in.
 */
export const POST = withAuth("impersonation:begin", async (req: NextRequest, callerId) => {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  const { data: session, error } = await supabaseAdmin
    .from("impersonation_sessions")
    .select("id, target_user_id, consumed_at, started_at, grant_id")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.target_user_id !== callerId) {
    return NextResponse.json({ error: "Session does not match caller" }, { status: 403 });
  }
  if (session.consumed_at) {
    return NextResponse.json({ error: "Session already consumed" }, { status: 400 });
  }
  // Intent tokens are short-lived to limit replay-window if a redirect URL
  // ends up in browser history or referrer logs. 10 min is plenty for the
  // magic-link round-trip.
  const ageMs = Date.now() - new Date(session.started_at).getTime();
  if (ageMs > 10 * 60 * 1000) {
    return NextResponse.json({ error: "Session token expired" }, { status: 400 });
  }

  // Verify the underlying grant is still valid. Without this, a session
  // started before the target hit "Revoke" could still be consumed.
  const { data: grant } = await supabaseAdmin
    .from("impersonation_grants")
    .select("status, expires_at")
    .eq("id", session.grant_id)
    .single();
  // null expires_at = indefinite, still active.
  if (
    !grant ||
    grant.status !== "approved" ||
    (grant.expires_at && new Date(grant.expires_at).getTime() < Date.now())
  ) {
    return NextResponse.json({ error: "Grant is no longer active" }, { status: 400 });
  }

  await supabaseAdmin
    .from("impersonation_sessions")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", sessionId);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(IMPERSONATION_COOKIE_NAME, sessionId, IMPERSONATION_COOKIE_OPTIONS);
  return res;
});
