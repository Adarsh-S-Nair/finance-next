import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../lib/api/auth";
import {
  getMembershipRole,
  listHouseholdMembers,
} from "../../../../lib/households/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: household, error: householdErr } = await supabaseAdmin
      .from("households")
      .select("id, name, color, created_by, created_at, updated_at")
      .eq("id", householdId)
      .maybeSingle();
    if (householdErr || !household) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const members = await listHouseholdMembers(householdId);
    return NextResponse.json({
      household: { ...household, role, member_count: members.length },
      members,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] get error", error);
    return NextResponse.json({ error: "Failed to load household" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60) {
      return NextResponse.json(
        { error: "Name is required (1-60 characters)" },
        { status: 400 },
      );
    }

    const { data: household, error: updateErr } = await supabaseAdmin
      .from("households")
      .update({ name })
      .eq("id", householdId)
      .select("id, name, color, created_by, created_at, updated_at")
      .single();
    if (updateErr || !household) {
      console.error("[households] rename error", updateErr);
      return NextResponse.json({ error: "Failed to rename household" }, { status: 500 });
    }

    return NextResponse.json({ household });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] rename error", error);
    return NextResponse.json({ error: "Failed to rename household" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("households")
      .delete()
      .eq("id", householdId);
    if (deleteErr) {
      console.error("[households] delete error", deleteErr);
      return NextResponse.json({ error: "Failed to delete household" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] delete error", error);
    return NextResponse.json({ error: "Failed to delete household" }, { status: 500 });
  }
}
