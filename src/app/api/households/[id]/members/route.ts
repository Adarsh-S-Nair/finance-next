import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../lib/api/auth";
import { getMembershipRole } from "../../../../../lib/households/server";

type RouteContext = { params: Promise<{ id: string }> };

type UserLookupRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/**
 * Owner-only: add a user to the household directly by their email. The
 * lookup and the insert happen atomically on the server so an inviter can't
 * race the UI. Returns 404 if the email doesn't match an existing user
 * (same response as the lookup endpoint, so we don't leak account existence
 * via a different status).
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const { data, error: rpcErr } = await supabaseAdmin.rpc("find_user_by_email", {
      p_email: email,
    });
    if (rpcErr) {
      console.error("[households] member add lookup error", rpcErr);
      return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
    }
    const rows = (data ?? []) as UserLookupRow[];
    const target = rows[0];
    if (!target) {
      return NextResponse.json({ error: "No account matches that email" }, { status: 404 });
    }
    if (target.id === userId) {
      return NextResponse.json({ error: "You're already a member" }, { status: 400 });
    }

    const existingRole = await getMembershipRole(householdId, target.id);
    if (existingRole) {
      return NextResponse.json({ error: "That person is already a member" }, { status: 409 });
    }

    const { error: insertErr } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: householdId, user_id: target.id, role: "member" });
    if (insertErr) {
      console.error("[households] member insert error", insertErr);
      return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
    }

    return NextResponse.json({
      member: {
        user_id: target.id,
        email: target.email,
        first_name: target.first_name,
        last_name: target.last_name,
        avatar_url: target.avatar_url,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] add member error", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}
