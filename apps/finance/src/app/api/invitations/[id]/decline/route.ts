import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../lib/api/auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Decline a targeted invitation. Marks the invite dismissed so it stops
 * showing in the invitee's notifications. The inviter can still see that
 * it was declined if we ever surface that (currently we just hide it).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: inviteId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("household_invitations")
      .select("id, invited_user_id, used_at, dismissed_at, revoked_at")
      .eq("id", inviteId)
      .maybeSingle();
    if (inviteErr) {
      console.error("[invitations] decline lookup error", inviteErr);
      return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (invite.invited_user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (invite.used_at || invite.dismissed_at || invite.revoked_at) {
      return NextResponse.json({ success: true });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("household_invitations")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (updateErr) {
      console.error("[invitations] decline update error", updateErr);
      return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[invitations] decline error", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
