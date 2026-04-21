import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../../lib/api/auth";
import { getMembershipRole } from "../../../../../../lib/households/server";

type RouteContext = { params: Promise<{ id: string; inviteId: string }> };

/**
 * Owner-only. Revoke a pending invite. Marks revoked_at so the invite
 * stops showing in outgoing lists and is no longer redeemable.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId, inviteId } = await context.params;
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
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] revoke invite error", error);
    return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 });
  }
}
