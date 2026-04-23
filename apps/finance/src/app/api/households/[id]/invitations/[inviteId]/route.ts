import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";
import { withAuth } from "../../../../../../lib/api/withAuth";
import { getMembershipRole } from "../../../../../../lib/households/server";

/**
 * Owner-only. Revoke a pending invite. Marks revoked_at so the invite
 * stops showing in outgoing lists and is no longer redeemable.
 */
export const DELETE = withAuth<{ id: string; inviteId: string }>("households:invitations:revoke", async (_request, userId, { params }) => {
    const { id: householdId, inviteId } = await params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("household_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("household_id", householdId);
    if (error) {
      console.error("[households] revoke invite error", error);
      return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});
