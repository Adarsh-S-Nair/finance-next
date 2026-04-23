import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { withAuth } from "../../../../../lib/api/withAuth";

/**
 * Accept a targeted invitation. The caller must be the invited user. On
 * success the caller becomes a household_members row and the invite is
 * marked used so it can't be re-accepted.
 */
export const POST = withAuth<{ id: string }>("invitations:accept", async (_request, userId, { params }) => {
    const { id: inviteId } = await params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("household_invitations")
      .select("id, household_id, invited_user_id, expires_at, used_at, dismissed_at, revoked_at")
      .eq("id", inviteId)
      .maybeSingle();
    if (inviteErr) {
      console.error("[invitations] accept lookup error", inviteErr);
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (invite.invited_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (invite.used_at || invite.dismissed_at || invite.revoked_at) {
      return NextResponse.json({ error: "Invitation no longer valid" }, { status: 410 });
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    // If they're somehow already a member (e.g. a code flow ran), treat as
    // accepted — still mark the invite used so it disappears from the bell.
    const { data: existing } = await supabaseAdmin
      .from("household_members")
      .select("user_id")
      .eq("household_id", invite.household_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: insertErr } = await supabaseAdmin
        .from("household_members")
        .insert({
          household_id: invite.household_id,
          user_id: userId,
          role: "member",
        });
      if (insertErr) {
        console.error("[invitations] accept insert error", insertErr);
        return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
      }
    }

    await supabaseAdmin
      .from("household_invitations")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", inviteId);

    return NextResponse.json({ household_id: invite.household_id });
});
