import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../../lib/api/auth";
import { getMembershipRole } from "../../../../../../lib/households/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (!role) {
      return NextResponse.json({ error: "Not a member" }, { status: 404 });
    }

    // If the caller is the only owner, block the leave so a household is
    // never left ownerless. They must either delete the household or transfer
    // ownership (transfer lands in a later milestone).
    if (role === "owner") {
      const { data: owners, error: ownersErr } = await supabaseAdmin
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId)
        .eq("role", "owner");
      if (ownersErr) {
        console.error("[households] owner count error", ownersErr);
        return NextResponse.json({ error: "Failed to leave household" }, { status: 500 });
      }
      if ((owners?.length ?? 0) <= 1) {
        return NextResponse.json(
          {
            error: "last_owner",
            message:
              "You are the only owner. Delete the household or transfer ownership first.",
          },
          { status: 400 },
        );
      }
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("household_members")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", userId);
    if (deleteErr) {
      console.error("[households] leave error", deleteErr);
      return NextResponse.json({ error: "Failed to leave household" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] leave error", error);
    return NextResponse.json({ error: "Failed to leave household" }, { status: 500 });
  }
}
