import { NextResponse } from "next/server";
import { supabaseAdmin } from "../supabase/admin";

export type ResolvedScope =
  | { kind: "personal"; userIds: string[] }
  | { kind: "household"; householdId: string; userIds: string[] };

/**
 * Resolve the caller's query scope from the request URL.
 *
 * If the URL includes `?householdId=<id>` and the caller is a member of that
 * household, returns the full list of member user ids so the route can expand
 * its query from `eq('user_id', userId)` to `in('user_id', memberIds)`.
 *
 * Otherwise returns the personal scope (just the caller's own id).
 *
 * Callers that fail membership verification get back a NextResponse they
 * should return directly.
 */
export async function resolveScope(
  request: Request,
  userId: string,
): Promise<ResolvedScope | NextResponse> {
  const householdId = new URL(request.url).searchParams.get("householdId");
  if (!householdId) return { kind: "personal", userIds: [userId] };

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: myMembership, error: membershipErr } = await supabaseAdmin
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipErr) {
    console.error("[scope] membership check error", membershipErr);
    return NextResponse.json({ error: "Failed to verify household membership" }, { status: 500 });
  }
  if (!myMembership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: members, error: membersErr } = await supabaseAdmin
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  if (membersErr) {
    console.error("[scope] members list error", membersErr);
    return NextResponse.json({ error: "Failed to load household members" }, { status: 500 });
  }

  const userIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  return { kind: "household", householdId, userIds };
}
