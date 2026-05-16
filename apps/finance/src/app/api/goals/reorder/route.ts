import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { withAuth } from "../../../../lib/api/withAuth";

type ReorderBody = {
  /**
   * Active goal IDs in their new display order (top of list first).
   * The endpoint enforces protection: protected goals always sort
   * ahead of unprotected ones regardless of the supplied order, so
   * an unprotected goal can't be promoted above an emergency fund
   * by a malicious client.
   */
  orderedIds: string[];
};

/**
 * POST /api/goals/reorder
 *
 * Bulk-update priorities for the caller's active goals. The
 * `orderedIds` payload represents the new visual order; the route
 * partitions it into protected vs unprotected segments and assigns
 * priorities so protected goals get negative values (sort first),
 * unprotected goals get non-negative values.
 *
 * One request instead of N PATCH calls so drag-and-drop feels
 * instant from the client's perspective — single network round trip.
 */
export const POST = withAuth("goals:reorder", async (request, userId) => {
  const body = (await request.json()) as ReorderBody;
  const ids = Array.isArray(body?.orderedIds) ? body.orderedIds : null;
  if (!ids || ids.length === 0) {
    return Response.json({ error: "orderedIds is required" }, { status: 400 });
  }

  // Load the user's active goals — we need is_protected to enforce the
  // ordering invariant and to verify every supplied id actually belongs
  // to the caller (service role bypasses RLS).
  const { data: goals, error: fetchError } = await supabaseAdmin
    .from("savings_goals")
    .select("id, is_protected")
    .eq("user_id", userId)
    .eq("status", "active");
  if (fetchError) {
    console.error("[goals:reorder] fetch failed:", fetchError);
    return Response.json({ error: "Failed to load goals" }, { status: 500 });
  }

  const byId = new Map<string, { id: string; is_protected: boolean }>(
    (goals ?? []).map((g) => [g.id, g]),
  );
  const unknown = ids.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    return Response.json(
      { error: "One or more ids don't belong to the caller" },
      { status: 403 },
    );
  }

  // Partition into protected + unprotected while preserving the user's
  // chosen sub-order within each segment.
  const protectedIds: string[] = [];
  const unprotectedIds: string[] = [];
  for (const id of ids) {
    if (byId.get(id)?.is_protected) protectedIds.push(id);
    else unprotectedIds.push(id);
  }

  // Assign priorities. Protected goals get negative values so they sort
  // ahead of any unprotected goal under `ORDER BY priority ASC`. We do
  // this with one bulk UPDATE per goal — Postgres has no clean upsert
  // path for "update many rows to different values" but Supabase's
  // single-row .update is fast enough at this list size (a user is
  // unlikely to have more than ~20 active goals).
  const updatePriority = (id: string, priority: number) =>
    supabaseAdmin
      .from("savings_goals")
      .update({ priority })
      .eq("id", id)
      .eq("user_id", userId)
      .then((r) => r);

  const updates = [
    ...protectedIds.map((id, i) =>
      updatePriority(id, -(protectedIds.length - i)),
    ),
    ...unprotectedIds.map((id, i) => updatePriority(id, i)),
  ];

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error);
  if (firstError) {
    console.error("[goals:reorder] update failed:", firstError.error);
    return Response.json(
      { error: "Failed to reorder goals" },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
});
