"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ViewAllLink } from "@zervo/ui";
import { useUser } from "../providers/UserProvider";
import { useAccounts } from "../providers/AccountsProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { formatCurrency } from "../../lib/formatCurrency";
import { allocateCash, rowToGoal, type Goal } from "../goals/types";

const GREEN_FILL = "#16a34a"; // emerald-600
const MAX_ROWS = 3;

const DEPOSITORY_SUBTYPES = new Set([
  "checking",
  "savings",
  "money market",
  "cash management",
  "hsa",
  "cd",
]);

function isDepository(t: string | null | undefined): boolean {
  return !!t && DEPOSITORY_SUBTYPES.has(t.toLowerCase());
}

type RawGoalRow = Parameters<typeof rowToGoal>[0];

/**
 * Dashboard summary of the user's savings goals. Headline shows total
 * cash flowing into goals; below it sits the top N active goals
 * (priority order, so emergency fund leads) each with a thin green
 * progress bar. Mirrors BudgetsCard so the two read as a pair.
 */
export default function GoalsCard() {
  const { user, loading: authLoading } = useUser();
  const { accounts: institutionGroups } = useAccounts();

  const { data: goalsPayload, isLoading } = useAuthedQuery<{
    data?: RawGoalRow[];
  }>(["goals:list", user?.id], user?.id ? "/api/goals" : null);

  const goals: Goal[] = useMemo(
    () => (goalsPayload?.data ?? []).map(rowToGoal),
    [goalsPayload],
  );

  // Cash pool — same calc as the /goals page. We need it because
  // progress is derived from the priority waterfall, not stored.
  const cashPool = useMemo(() => {
    const flat = institutionGroups.flatMap(
      (g: { accounts?: { type: string | null; balance: number }[] }) =>
        g.accounts ?? [],
    );
    return flat
      .filter((a) => isDepository(a.type))
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [institutionGroups]);

  const { allocated } = useMemo(
    () => allocateCash(goals, cashPool),
    [goals, cashPool],
  );

  const topGoals = allocated.slice(0, MAX_ROWS);

  const loading = authLoading || (isLoading && !goalsPayload);

  // ─── Loading skeleton ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Goals</h3>
        </div>
        <div className="animate-pulse space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-3 bg-[var(--color-border)] rounded flex-1" />
                <div className="h-2.5 bg-[var(--color-border)] rounded w-8" />
              </div>
              <div className="h-2 bg-[var(--color-border)] rounded-full" />
              <div className="flex justify-between">
                <div className="h-2.5 bg-[var(--color-border)] rounded w-12" />
                <div className="h-2.5 bg-[var(--color-border)] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────

  if (goals.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-6">
          <h3 className="card-header">Goals</h3>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-sm text-[var(--color-fg)] mb-1">
            No savings goals yet
          </p>
          <p className="text-xs text-[var(--color-muted)] mb-4">
            Set an emergency fund first, then save toward anything else.
          </p>
          <Link
            href="/goals"
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-medium bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 transition-opacity w-fit"
          >
            Set up a goal
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-header">Goals</h3>
        <ViewAllLink href="/goals" />
      </div>

      {/* Top goals in priority order — emergency fund leads. */}
      <div className="space-y-6">
        {topGoals.map((g) => {
          const pct = Math.round(g.progress * 100);
          const isFull = g.progress >= 1;
          const isUnfunded = g.allocated <= 0;
          const fillPct = Math.min(100, g.progress * 100);
          return (
            <div key={g.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--color-fg)] truncate flex-1">
                  {g.name}
                </span>
                <span
                  className={`text-[11px] tabular-nums font-semibold flex-shrink-0 ${
                    isFull
                      ? "text-emerald-600"
                      : isUnfunded
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-fg)]"
                  }`}
                >
                  {isUnfunded ? "0%" : `${pct}%`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${fillPct}%`,
                    backgroundColor: GREEN_FILL,
                  }}
                />
              </div>
              <div className="flex items-baseline justify-between text-[11px] tabular-nums">
                <span className="text-[var(--color-fg)] font-medium">
                  {isUnfunded ? "$0" : formatCurrency(g.allocated)}
                </span>
                <span className="text-[var(--color-muted)]">
                  of {formatCurrency(g.target)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
