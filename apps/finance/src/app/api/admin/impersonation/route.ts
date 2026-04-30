import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { isCallerAdmin } from "../../../../lib/api/admin";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { isOpen, type GrantRow } from "../../../../lib/impersonation/status";

// 0 = indefinite (no expires_at, lasts until target revokes).
const VALID_DURATIONS = new Set([0, 3_600, 86_400, 604_800]);

/**
 * Admin requests impersonation access to a target user. The target must
 * approve in their finance app before the grant becomes usable. We refuse
 * to create a second open grant for the same (requester, target) pair so
 * the user's banner doesn't accumulate stacked requests.
 */
export const POST = withAuth("admin:impersonation:create", async (req, callerId) => {
  if (!(await isCallerAdmin(callerId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    target_user_id?: string;
    reason?: string;
    duration_seconds?: number;
  };

  const targetUserId = body.target_user_id?.trim();
  if (!targetUserId) {
    return NextResponse.json({ error: "target_user_id required" }, { status: 400 });
  }

  const duration = body.duration_seconds ?? 86_400;
  if (!VALID_DURATIONS.has(duration)) {
    return NextResponse.json(
      { error: "duration_seconds must be 0, 3600, 86400, or 604800" },
      { status: 400 },
    );
  }

  // Confirm the target exists. Without this we'd happily create a grant
  // pointing at a nonexistent uuid that the FK would only catch on insert
  // — surface the error early so the admin sees a clean message.
  const { data: target, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(
    targetUserId,
  );
  if (targetErr || !target?.user) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  // Refuse to stack requests on the same target. If there's already a
  // pending or active (approved + unexpired) grant, return it instead.
  const { data: existing } = await supabaseAdmin
    .from("impersonation_grants")
    .select("id, status, expires_at, decided_at, duration_seconds, requested_at, reason")
    .eq("requester_id", callerId)
    .eq("target_user_id", targetUserId)
    .in("status", ["pending", "approved"])
    .order("requested_at", { ascending: false })
    .limit(1);

  const open = (existing as GrantRow[] | null)?.find((g) => isOpen(g));
  if (open) {
    return NextResponse.json({ grant: open, already_open: true });
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("impersonation_grants")
    .insert({
      requester_id: callerId,
      target_user_id: targetUserId,
      status: "pending",
      reason: body.reason?.slice(0, 500) ?? null,
      duration_seconds: duration,
    })
    .select("id, status, expires_at, decided_at, duration_seconds, requested_at, reason")
    .single();

  if (insertErr || !inserted) {
    console.error("[admin:impersonation:create] insert failed", insertErr);
    return NextResponse.json({ error: "Could not create grant" }, { status: 500 });
  }

  return NextResponse.json({ grant: inserted });
});

/**
 * List the caller's grants against a specific target. Used by the admin
 * UserDrawer to show current state ("pending", "active", or "request").
 * Caller must be an admin AND the requester on the grants we return —
 * we never leak grants belonging to other admins.
 */
export const GET = withAuth("admin:impersonation:list", async (req: NextRequest, callerId) => {
  if (!(await isCallerAdmin(callerId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = req.nextUrl.searchParams.get("target");
  if (!target) {
    return NextResponse.json({ error: "target query param required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("impersonation_grants")
    .select("id, status, expires_at, decided_at, duration_seconds, requested_at, reason")
    .eq("requester_id", callerId)
    .eq("target_user_id", target)
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[admin:impersonation:list] query failed", error);
    return NextResponse.json({ error: "Could not load grants" }, { status: 500 });
  }

  return NextResponse.json({ grants: data ?? [] });
});
