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

    // Count the household so we can decide between a normal leave and an
    // auto-delete. If the caller is the only member, leaving removes the
    // household entirely — no point keeping an empty one around.
    const { data: allMembers, error: membersErr } = await supabaseAdmin
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", householdId);
    if (membersErr) {
      console.error("[households] leave member count error", membersErr);
      return NextResponse.json({ error: "Failed to leave household" }, { status: 500 });
    }

    const memberRows = (allMembers ?? []) as Array<{ user_id: string; role: string }>;
    const memberCount = memberRows.length;
    const ownerCount = memberRows.filter((m) => m.role === "owner").length;

    if (memberCount <= 1) {
      const { error: deleteHouseholdErr } = await supabaseAdmin
        .from("households")
        .delete()
        .eq("id", householdId);
      if (deleteHouseholdErr) {
        console.error("[households] cascade delete error", deleteHouseholdErr);
        return NextResponse.json(
          { error: "Failed to leave household" },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, deleted: true });
    }

    // If the caller is the only owner but other members remain, block the
    // leave so the household is never left ownerless. They must delete the
    // household or transfer ownership (transfer lands in a later milestone).
    if (role === "owner" && ownerCount <= 1) {
      return NextResponse.json(
        {
          error: "last_owner",
          message:
            "You are the only owner. Delete the household or transfer ownership first.",
        },
        { status: 400 },
      );
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
