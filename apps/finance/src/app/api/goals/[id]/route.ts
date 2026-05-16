import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { withAuth } from "../../../../lib/api/withAuth";
import type { Tables, TablesInsert, TablesUpdate } from "../../../../types/database";

type LineItemRow = Tables<"savings_goal_line_items">;

type LineItemPayload = {
  id?: string;
  name: string;
  target_amount: number | string;
  sort_order?: number;
};

type UpdateGoalBody = Partial<{
  name: string;
  target_amount: number | string;
  target_date: string | null;
  status: "active" | "complete" | "archived";
  color: string;
  icon: string | null;
  ef_multiplier: number | null;
  excluded_essential_category_ids: string[];
  /**
   * Full replacement of line items when present. Pass an empty array
   * to delete all line items. Omit entirely to leave line items
   * untouched. We chose replace-on-update instead of diffing because
   * the line item set is small (most goals have 0-6 items) and the
   * caller already manages line items as a unit in the create modal.
   */
  line_items: LineItemPayload[];
}>;

/**
 * PATCH /api/goals/[id]
 *
 * Update a goal's mutable fields. The user can't change kind or
 * is_protected via this route — those are set at creation only and
 * intentionally frozen so a custom goal can't be promoted into a
 * protected one without going through the proper EF setup flow.
 *
 * When `line_items` is supplied, this is a full replacement: existing
 * items are deleted and the new array is inserted. Omit the key to
 * leave line items untouched.
 */
export const PATCH = withAuth<{ id: string }>(
  "goals:update",
  async (request, userId, { params }) => {
    const { id } = await params;
    if (!id) {
      return Response.json({ error: "Missing goal id" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateGoalBody;

    // Make sure the goal belongs to the caller before we let any
    // updates through — service-role bypasses RLS, so the check has
    // to live here.
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("savings_goals")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchError) {
      console.error("[goals:update] fetch failed:", fetchError);
      return Response.json({ error: "Failed to load goal" }, { status: 500 });
    }
    if (!existing) {
      return Response.json({ error: "Goal not found" }, { status: 404 });
    }

    const patch: TablesUpdate<"savings_goals"> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.target_amount !== undefined) {
      const n = Number(body.target_amount);
      if (!Number.isFinite(n) || n <= 0) {
        return Response.json({ error: "Target must be > 0" }, { status: 400 });
      }
      patch.target_amount = n;
    }
    if (body.target_date !== undefined) patch.target_date = body.target_date;
    if (body.status !== undefined) patch.status = body.status;
    if (body.color !== undefined) patch.color = body.color;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.ef_multiplier !== undefined) patch.ef_multiplier = body.ef_multiplier;
    if (body.excluded_essential_category_ids !== undefined) {
      patch.excluded_essential_category_ids =
        body.excluded_essential_category_ids;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("savings_goals")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId);
      if (updateError) {
        console.error("[goals:update] update failed:", updateError);
        return Response.json(
          { error: "Failed to update goal" },
          { status: 500 },
        );
      }
    }

    // Replace line items if a new array was supplied.
    if (body.line_items !== undefined) {
      const { error: deleteError } = await supabaseAdmin
        .from("savings_goal_line_items")
        .delete()
        .eq("goal_id", id);
      if (deleteError) {
        console.error("[goals:update] delete line items failed:", deleteError);
      }
      if (body.line_items.length > 0) {
        const itemsPayload: TablesInsert<"savings_goal_line_items">[] =
          body.line_items
            .filter((li) => li.name?.trim() && Number(li.target_amount) >= 0)
            .map((li, idx) => ({
              goal_id: id,
              name: li.name.trim(),
              target_amount: Number(li.target_amount),
              sort_order: li.sort_order ?? idx,
            }));
        if (itemsPayload.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from("savings_goal_line_items")
            .insert(itemsPayload);
          if (insertError) {
            console.error("[goals:update] insert line items failed:", insertError);
          }
        }
      }
    }

    // Return the hydrated record so the client can replace its cached row.
    const { data: refreshed } = await supabaseAdmin
      .from("savings_goals")
      .select("*")
      .eq("id", id)
      .single();
    const { data: items } = await supabaseAdmin
      .from("savings_goal_line_items")
      .select("*")
      .eq("goal_id", id)
      .order("sort_order", { ascending: true });

    return Response.json({
      data: { ...(refreshed ?? {}), line_items: (items ?? []) as LineItemRow[] },
    });
  },
);

/**
 * DELETE /api/goals/[id]
 *
 * Hard-delete the goal. Line items cascade via FK ON DELETE CASCADE.
 * Soft-delete is available via PATCH status=archived for users who
 * want to keep the goal in their history.
 */
export const DELETE = withAuth<{ id: string }>(
  "goals:delete",
  async (_request, userId, { params }) => {
    const { id } = await params;
    if (!id) {
      return Response.json({ error: "Missing goal id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("savings_goals")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("[goals:delete] failed:", error);
      return Response.json({ error: "Failed to delete goal" }, { status: 500 });
    }
    return Response.json({ success: true });
  },
);
