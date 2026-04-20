import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../lib/api/auth";
import {
  generateInviteCode,
  getMembershipRole,
} from "../../../../../lib/households/server";

type RouteContext = { params: Promise<{ id: string }> };

const INVITE_TTL_DAYS = 7;

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

    const { data, error } = await supabaseAdmin
      .from("household_invitations")
      .select("id, code, created_by, expires_at, revoked_at, used_at, used_by, created_at")
      .eq("household_id", householdId)
      .is("revoked_at", null)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[households] list invitations error", error);
      return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
    }

    return NextResponse.json({ invitations: data ?? [] });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] list invitations error", error);
    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}

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

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITE_TTL_DAYS);

    // Retry on the (extremely unlikely) code collision. The code space is
    // 31^8 ≈ 8.5 × 10^11 so 5 tries is more than enough.
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateInviteCode();
      const { data, error } = await supabaseAdmin
        .from("household_invitations")
        .insert({
          household_id: householdId,
          code,
          created_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .select("id, code, created_by, expires_at, revoked_at, used_at, used_by, created_at")
        .single();
      if (!error && data) {
        return NextResponse.json({ invitation: data });
      }
      lastError = error;
      // Unique violation retries; any other error short-circuits.
      if (error?.code !== "23505") break;
    }

    console.error("[households] create invitation error", lastError);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] create invitation error", error);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
