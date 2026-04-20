import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../lib/api/auth";
import { listHouseholdsForUser } from "../../../lib/households/server";

export async function GET(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
    const households = await listHouseholdsForUser(userId);
    return NextResponse.json({ households });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] list error", error);
    return NextResponse.json({ error: "Failed to list households" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
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

    const { data: household, error: createErr } = await supabaseAdmin
      .from("households")
      .insert({ name, created_by: userId })
      .select("id, name, created_by, created_at, updated_at")
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
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] create error", error);
    return NextResponse.json({ error: "Failed to create household" }, { status: 500 });
  }
}
