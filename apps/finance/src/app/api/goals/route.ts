import { supabaseAdmin } from "../../../lib/supabase/admin";
import { withAuth } from "../../../lib/api/withAuth";
import type { Tables, TablesInsert } from "../../../types/database";

type GoalRow = Tables<"savings_goals">;
type LineItemRow = Tables<"savings_goal_line_items">;

type LineItemPayload = {
  name: string;
  target_amount: number | string;
  sort_order?: number;
};

type CreateGoalBody = {
  name: string;
  kind?: "custom" | "emergency_fund";
  target_amount: number | string;
  target_date?: string | null;
  color?: string;
  icon?: string | null;
  is_protected?: boolean;
  ef_multiplier?: number | null;
  excluded_essential_category_ids?: string[];
  line_items?: LineItemPayload[];
};

/**
 * GET /api/goals
 *
 * Returns the caller's savings goals along with their line items. The
 * shape is denormalized for the client: each goal has a `line_items`
 * array hydrated by an explicit join. Ordered by status (active first)
 * then priority (lower = higher priority).
 */
export const GET = withAuth("goals:list", async (_request, userId) => {
  const { data: goals, error: goalsError } = await supabaseAdmin
    .from("savings_goals")
    .select("*")
    .eq("user_id", userId)
    .order("status", { ascending: true })
    .order("is_protected", { ascending: false })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (goalsError) {
    console.error("[goals:list] failed:", goalsError);
    return Response.json({ error: "Failed to load goals" }, { status: 500 });
  }

  const goalIds = (goals ?? []).map((g: GoalRow) => g.id);
  const lineItemsByGoal: Record<string, LineItemRow[]> = {};
  if (goalIds.length > 0) {
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("savings_goal_line_items")
      .select("*")
      .in("goal_id", goalIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (itemsError) {
      console.error("[goals:list] line items failed:", itemsError);
    } else if (items) {
      for (const item of items) {
        if (!lineItemsByGoal[item.goal_id]) lineItemsByGoal[item.goal_id] = [];
        lineItemsByGoal[item.goal_id].push(item);
      }
    }
  }

  const hydrated = (goals ?? []).map((g: GoalRow) => ({
    ...g,
    line_items: lineItemsByGoal[g.id] ?? [],
  }));

  return Response.json({ data: hydrated });
});

/**
 * POST /api/goals
 *
 * Create a new goal. Optional `line_items` are inserted in one batch
 * after the parent row. Priority is auto-assigned (max existing + 1)
 * unless the goal is protected, in which case it sorts ahead of
 * unprotected goals via a negative priority.
 *
 * Caller does NOT pass user_id; we derive it from the verified JWT.
 */
export const POST = withAuth("goals:create", async (request, userId) => {
  const body = (await request.json()) as CreateGoalBody;

  if (!body.name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  const targetNum = Number(body.target_amount);
  if (!Number.isFinite(targetNum) || targetNum <= 0) {
    return Response.json({ error: "Target must be > 0" }, { status: 400 });
  }

  const kind = body.kind === "emergency_fund" ? "emergency_fund" : "custom";
  const isProtected = kind === "emergency_fund" ? true : !!body.is_protected;

  // Auto-assign priority. Protected goals get a negative priority so
  // they always sort first in the waterfall.
  const { data: existingPriorities } = await supabaseAdmin
    .from("savings_goals")
    .select("priority, is_protected")
    .eq("user_id", userId)
    .eq("status", "active");

  const unprotectedMax = (existingPriorities ?? [])
    .filter((g) => !g.is_protected)
    .reduce((m, g) => Math.max(m, g.priority ?? 0), -1);
  const protectedMin = (existingPriorities ?? [])
    .filter((g) => g.is_protected)
    .reduce((m, g) => Math.min(m, g.priority ?? 0), 0);

  const priority = isProtected ? protectedMin - 1 : unprotectedMax + 1;

  const insertPayload: TablesInsert<"savings_goals"> = {
    user_id: userId,
    name: body.name.trim(),
    kind,
    target_amount: targetNum,
    target_date: body.target_date || null,
    priority,
    is_protected: isProtected,
    color: body.color || (isProtected ? "#64748b" : "#0891b2"),
    icon: body.icon ?? null,
    ef_multiplier:
      kind === "emergency_fund" && body.ef_multiplier != null
        ? body.ef_multiplier
        : null,
    excluded_essential_category_ids:
      body.excluded_essential_category_ids ?? [],
  };

  const { data: created, error: createError } = await supabaseAdmin
    .from("savings_goals")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createError || !created) {
    console.error("[goals:create] failed:", createError);
    return Response.json(
      {
        error:
          createError?.code === "23505"
            ? "You already have an active emergency fund."
            : "Failed to create goal",
      },
      { status: createError?.code === "23505" ? 409 : 500 },
    );
  }

  // Optional batched line items.
  let createdLineItems: LineItemRow[] = [];
  if (body.line_items && body.line_items.length > 0) {
    const itemsPayload: TablesInsert<"savings_goal_line_items">[] = body.line_items
      .filter((li) => li.name?.trim() && Number(li.target_amount) >= 0)
      .map((li, idx) => ({
        goal_id: created.id,
        name: li.name.trim(),
        target_amount: Number(li.target_amount),
        sort_order: li.sort_order ?? idx,
      }));
    if (itemsPayload.length > 0) {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from("savings_goal_line_items")
        .insert(itemsPayload)
        .select("*");
      if (itemsError) {
        console.error("[goals:create] line items failed:", itemsError);
        // Don't roll back — the parent goal is the more important record.
        // Frontend will refetch and see whatever made it in.
      } else if (items) {
        createdLineItems = items;
      }
    }
  }

  return Response.json({
    data: { ...created, line_items: createdLineItems },
  });
});
