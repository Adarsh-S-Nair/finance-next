"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ViewAllLink } from "@zervo/ui";
import { useUser } from "../providers/UserProvider";
import { useAccounts } from "../providers/AccountsProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { formatCurrency } from "../../lib/formatCurrency";
import { allocateCash, rowToGoal, type Goal } from "../goals/types";

const GREEN_FILL = "#16a34a"; // emerald-600
// Carousel caps at 5 — past that the dot row gets too crowded and the
// user should be on /goals anyway. ViewAllLink in the header handles
// the overflow.
const MAX_VISIBLE = 5;

// Ring geometry. Sized to feel like a hero number in a sidebar card
// (~320px wide), with enough stroke to read as a confident gauge
// rather than a thin progress indicator.
const RING_SIZE = 160;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

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
 * Dashboard summary of the user's savings goals. Displays one goal at
 * a time as a hero ring with carousel navigation between goals.
 * Replaces the previous bar-row stack so the sidebar has visual
 * variety against the bar-heavy Budgets card directly above it, and
 * so a fully-funded goal lands with the "achievement" weight that a
 * flat bar can't carry.
 */
export default function GoalsCard() {
  const { user, loading: authLoading } = useUser();
  const { accounts: institutionGroups } = useAccounts();
  const [index, setIndex] = useState(0);

  const { data: goalsPayload, isLoading } = useAuthedQuery<{
    data?: RawGoalRow[];
  }>(["goals:list", user?.id], user?.id ? "/api/goals" : null);

  const goals: Goal[] = useMemo(
    () => (goalsPayload?.data ?? []).map(rowToGoal),
    [goalsPayload],
  );

  // Cash pool — same calc as the /goals page. Needed because progress
  // is derived from the priority waterfall, not stored.
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

  const visibleGoals = allocated.slice(0, MAX_VISIBLE);

  // Snap the index back into range if the goals list shrank (e.g.
  // the user deleted a goal on another tab and the cache invalidated).
  useEffect(() => {
    if (index > visibleGoals.length - 1 && visibleGoals.length > 0) {
      setIndex(0);
    }
  }, [index, visibleGoals.length]);

  const activeIndex = Math.min(index, Math.max(0, visibleGoals.length - 1));
  const goal = visibleGoals[activeIndex];

  const loading = authLoading || (isLoading && !goalsPayload);

  // ─── Loading skeleton ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Goals</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
          <div
            className="rounded-full bg-[var(--color-border)]"
            style={{ width: RING_SIZE, height: RING_SIZE }}
          />
          <div className="h-3 w-28 bg-[var(--color-border)] rounded mt-5" />
          <div className="h-2.5 w-32 bg-[var(--color-border)] rounded mt-2" />
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

  if (!goal) return null;

  // ─── Active goal derived values ─────────────────────────────────────

  const pct = Math.round(goal.progress * 100);
  const isFull = goal.progress >= 1;
  const isUnfunded = goal.allocated <= 0;
  const fillFraction = Math.min(1, Math.max(0, goal.progress));
  const dashOffset = RING_CIRC * (1 - fillFraction);

  const ringStroke = isUnfunded
    ? "var(--color-border)"
    : GREEN_FILL;

  // ─── Main render ─────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-header">Goals</h3>
        <ViewAllLink href="/goals" />
      </div>

      {/* Ring + label area. AnimatePresence swaps the whole block on
          carousel change with a quick fade+slide so the user feels the
          transition without it being long enough to slow them down. */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <div
              className="relative"
              style={{ width: RING_SIZE, height: RING_SIZE }}
            >
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                className="-rotate-90"
                aria-hidden
              >
                {/* Track */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--color-surface-alt)"
                  strokeWidth={RING_STROKE}
                />
                {/* Progress — strokeDashoffset animates from full-empty
                    to the actual offset on mount so each goal change
                    feels like the ring "fills in". */}
                <motion.circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  initial={{ strokeDashoffset: RING_CIRC }}
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{
                    duration: 0.7,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    // Soft halo when fully funded — gives the "you did
                    // it" moment a little glow rather than just a
                    // solid stroke.
                    filter: isFull
                      ? `drop-shadow(0 0 8px ${GREEN_FILL}66)`
                      : undefined,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-3xl font-medium tracking-tight tabular-nums ${
                    isFull
                      ? "text-emerald-600"
                      : isUnfunded
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-fg)]"
                  }`}
                >
                  {pct}%
                </span>
              </div>
            </div>

            {/* Name + amount under the ring. Centered to match. */}
            <div className="mt-5 text-center max-w-full">
              <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                {goal.name}
              </div>
              <div className="text-[11px] text-[var(--color-muted)] tabular-nums mt-1">
                {isUnfunded ? "$0" : formatCurrency(goal.allocated)}{" "}
                <span className="text-[var(--color-muted)]">of</span>{" "}
                {formatCurrency(goal.target)}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators. Active dot widens — gentler than a filled
            circle vs hollow circle, and it carries the user's sense
            of position better. Hidden when there's only one goal. */}
        {visibleGoals.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {visibleGoals.map((g, i) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${g.name}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === activeIndex
                    ? "w-5 bg-[var(--color-fg)]"
                    : "w-1.5 bg-[var(--color-border)] hover:bg-[var(--color-muted)]"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
