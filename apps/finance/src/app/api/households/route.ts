import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { withAuth } from "../../../lib/api/withAuth";
import { listHouseholdsForUser, pickRandomHouseholdColor } from "../../../lib/households/server";

export const GET = withAuth("households:list", async (_request, userId) => {
  const households = await listHouseholdsForUser(userId);
  return NextResponse.json({ households });
});

export const POST = withAuth("households:create", async (request, userId) => {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      return NextResponse.json(
        { error: "Name is required (1-60 characters)" },
        { status: 400 },
      );
    }

    const color = pickRandomHouseholdColor();
    const { data: household, error: createErr } = await supabaseAdmin
      .from("households")
      .insert({ name, color, created_by: userId })
      .select("id, name, color, created_by, created_at, updated_at")
      .single();
    if (createErr || !household) {
      console.error("[households] create error", createErr);
      return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
    }

    const { error: memberErr } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: household.id, user_id: userId, role: "owner" });
    if (memberErr) {
      // Roll back household so we don't leave an orphan with no members.
      await supabaseAdmin.from("households").delete().eq("id", household.id);
      console.error("[households] owner membership error", memberErr);
      return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
    }

  return NextResponse.json({
    household: { ...household, role: "owner" as const, member_count: 1 },
  });
});
