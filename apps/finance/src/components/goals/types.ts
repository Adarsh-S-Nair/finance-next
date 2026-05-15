// Goals prototype — mock types, seed data, allocation algorithm.
// Everything in this file is in-memory only. No DB, no API. Once the UI
// shape settles, this becomes the schema + a server-side helper.

export type GoalKind = "emergency_fund" | "custom";
export type GoalStatus = "active" | "complete" | "archived";

export type GoalLineItem = {
  id: string;
  name: string;
  target: number;
};

export type Goal = {
  id: string;
  name: string;
  kind: GoalKind;
  target: number;
  /** ISO date string (YYYY-MM-DD). Optional. */
  targetDate?: string;
  /** Lower number = higher priority in the allocation order. */
  priority: number;
  status: GoalStatus;
  /** Protected goals (emergency fund) cannot be demoted below an unprotected goal. */
  isProtected: boolean;
  /** Display color used in the allocation strip and the row fill. */
  color: string;
  lineItems: GoalLineItem[];
};

export type AllocatedGoal = Goal & {
  /** Dollars currently flowing into this goal from the cash pool. */
  allocated: number;
  /** allocated / target, clamped 0..1. */
  progress: number;
};

/**
 * Run the priority waterfall: protected goals first, then by priority asc,
 * each goal fills up to its target before the next one gets anything.
 * Returns the goals with `allocated` / `progress` filled in, plus the
 * leftover cash that didn't get assigned to any goal.
 */
export function allocateCash(
  goals: Goal[],
  cashPool: number,
): { allocated: AllocatedGoal[]; unallocated: number } {
  const active = goals.filter((g) => g.status === "active");
  const ordered = [...active].sort((a, b) => {
    if (a.isProtected !== b.isProtected) return a.isProtected ? -1 : 1;
    return a.priority - b.priority;
  });

  let remaining = Math.max(0, cashPool);
  const allocated: AllocatedGoal[] = ordered.map((g) => {
    const got = Math.min(g.target, remaining);
    remaining -= got;
    return { ...g, allocated: got, progress: g.target > 0 ? got / g.target : 0 };
  });

  return { allocated, unallocated: remaining };
}

// ─── Mock seed data ───────────────────────────────────────────────────

export const MOCK_CASH_POOL = 19000;

/** Used by the deterministic emergency-fund suggestion flow. */
export const MOCK_MONTHLY_ESSENTIAL_SPEND = 4200;

export const MOCK_GOALS: Goal[] = [
  {
    id: "g_emergency_fund",
    name: "Emergency Fund",
    kind: "emergency_fund",
    target: 15000,
    priority: 0,
    status: "active",
    isProtected: true,
    color: "#64748b",
    lineItems: [],
  },
  {
    id: "g_trip",
    name: "European Trip",
    kind: "custom",
    target: 3200,
    targetDate: "2026-07-15",
    priority: 1,
    status: "active",
    isProtected: false,
    color: "#0891b2",
    lineItems: [
      { id: "li_flights", name: "Flights", target: 800 },
      { id: "li_hotel", name: "Hotel", target: 1400 },
      { id: "li_food", name: "Food", target: 600 },
      { id: "li_activities", name: "Activities", target: 400 },
    ],
  },
  {
    id: "g_couch",
    name: "Living Room Couch",
    kind: "custom",
    target: 1200,
    priority: 2,
    status: "active",
    isProtected: false,
    color: "#7c3aed",
    lineItems: [],
  },
  {
    id: "g_anniv",
    name: "Anniversary Gift",
    kind: "custom",
    target: 500,
    targetDate: "2026-08-20",
    priority: 3,
    status: "active",
    isProtected: false,
    color: "#db2777",
    lineItems: [],
  },
  {
    id: "g_laptop_done",
    name: "New Laptop",
    kind: "custom",
    target: 2000,
    priority: 99,
    status: "complete",
    isProtected: false,
    color: "#65a30d",
    lineItems: [],
  },
];

/** A rotating palette for new goals so they look distinct in the strip. */
export const GOAL_COLOR_PALETTE = [
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#db2777", // pink
  "#65a30d", // lime
  "#ea580c", // orange
  "#0ea5e9", // sky
  "#9333ea", // purple
  "#16a34a", // green
];

export function nextGoalColor(existing: Goal[]): string {
  const used = new Set(existing.map((g) => g.color));
  return (
    GOAL_COLOR_PALETTE.find((c) => !used.has(c)) ??
    GOAL_COLOR_PALETTE[existing.length % GOAL_COLOR_PALETTE.length]
  );
}

// ─── Pace evaluation (target-date based) ──────────────────────────────

export type Pace = "on_pace" | "behind" | "ahead" | "no_date" | "unfunded" | "complete";

/**
 * Given the goal's current allocation and its target date, classify the
 * pace. Heuristic: required monthly contribution = remaining / months_left.
 * If `allocated/target` is meaningfully ahead of `elapsed/total_duration`
 * (within ±5%), call it on-pace; otherwise ahead / behind.
 *
 * For undated goals we just return "no_date" — the badge becomes the
 * percentage instead.
 */
export function evaluatePace(
  goal: AllocatedGoal,
  today: Date = new Date(),
): Pace {
  if (goal.status === "complete") return "complete";
  if (goal.allocated <= 0) return "unfunded";
  if (!goal.targetDate) return "no_date";

  const due = new Date(goal.targetDate);
  // We assume the goal started accruing roughly when it was created, but
  // we don't track that in the mock data — so for the prototype use a
  // simple absolute test: if you're already at or past target on the
  // pace bar, you're on track. Otherwise compare progress to time-elapsed
  // from "now" to "due" treating today as the anchor and assuming a
  // 6-month accrual window.
  const monthsLeft = Math.max(
    0,
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30),
  );
  if (monthsLeft <= 0) {
    return goal.progress >= 1 ? "on_pace" : "behind";
  }
  // Treat a 6-month default window as the assumed total runway.
  const assumedWindowMonths = 6;
  const elapsedFraction = Math.min(
    1,
    Math.max(0, (assumedWindowMonths - monthsLeft) / assumedWindowMonths),
  );
  const delta = goal.progress - elapsedFraction;
  if (delta > 0.05) return "ahead";
  if (delta < -0.05) return "behind";
  return "on_pace";
}

export function formatTargetDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTargetDate(iso: string, today: Date = new Date()): string {
  const due = new Date(iso);
  const ms = due.getTime() - today.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "today";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return `in ${(days / 365).toFixed(1)} years`;
}
