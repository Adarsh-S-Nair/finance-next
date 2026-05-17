"use client";

import React, { useState, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import Link from "next/link";
import { useUser } from "../providers/UserProvider";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";
import { ViewAllLink } from "@zervo/ui";

const MAX_ROWS = 3;

// Editorial direction: no per-row progress bars — the typography is
// the design. The percentage on each row is colored by status, which
// is what carries the at-a-glance "should I worry?" signal.
//
// Status thresholds:
//   - "over"     : displayed dollar amount strictly exceeds the cap
//                  (cents within the same whole dollar don't count
//                  as over — Math.round on both sides keeps this
//                  honest)
//   - "at"       : exactly at the cap (rose 100% reads as alarming
//                  when the user actually hit their target — emerald
//                  feels more like "you nailed it")
//   - "warn"     : 85-99% (amber attention zone)
//   - "normal"   : everything else (foreground)
function statusFor(spent, total) {
  if (Math.round(spent) > Math.round(total)) return "over";
  const pct = total > 0 ? (spent / total) * 100 : 0;
  if (pct >= 100) return "at";
  if (pct >= 85) return "warn";
  return "normal";
}

const STATUS_TEXT = {
  over: "text-rose-500",
  at: "text-emerald-500",
  warn: "text-amber-500",
  normal: "text-[var(--color-fg)]",
};

function BudgetRow({ budget }) {
  const label =
    budget.category_groups?.name ||
    budget.system_categories?.label ||
    "Unknown";

  const total = Number(budget.amount) || 0;
  const spent = Number(budget.spent) || 0;
  const percentage = Number(budget.percentage) || 0;
  const status = statusFor(spent, total);
  // The numeric percentage isn't clamped — show the real overage when
  // a budget is genuinely past its cap. "123%" reads truer than
  // "100%" in that case.
  const pctDisplay = Math.round(percentage);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-[var(--color-fg)] truncate">
          {label}
        </span>
        <span
          className={`text-[11px] tabular-nums font-semibold flex-shrink-0 ${STATUS_TEXT[status]}`}
        >
          {pctDisplay}%
        </span>
      </div>
      <div className="flex items-baseline justify-between text-[11px] tabular-nums text-[var(--color-muted)]">
        <span>
          <span className="text-[var(--color-fg)] font-medium">
            {formatCurrency(spent)}
          </span>{" "}
          of {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export default function BudgetsCard({ budgets: budgetsProp, loading: loadingProp }) {
  const { user, loading: authLoading } = useUser();
  const [budgetsState, setBudgetsState] = useState([]);
  const [loadingState, setLoadingState] = useState(true);

  const controlled = budgetsProp !== undefined;
  const budgets = controlled ? budgetsProp : budgetsState;
  const loading = controlled ? !!loadingProp : loadingState;

  useEffect(() => {
    if (controlled) return;
    if (authLoading) return;
    if (!user?.id) { setLoadingState(false); return; }
    async function fetchBudgets() {
      setLoadingState(true);
      try {
        const res = await authFetch(`/api/budgets`);
        const json = await res.json();
        setBudgetsState(json.data || []);
      } catch (e) {
        console.error("Error fetching budgets:", e);
      } finally {
        setLoadingState(false);
      }
    }
    fetchBudgets();
  }, [controlled, authLoading, user?.id]);

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0);
  const remaining = totalBudget - totalSpent;

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-[var(--color-border)] rounded w-28 mb-3" />
          <div className="h-2.5 bg-[var(--color-border)] rounded w-20 mb-6" />
          <div className="h-2.5 bg-[var(--color-border)] rounded w-40 mb-8" />
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-3 bg-[var(--color-border)] rounded flex-1" />
                  <div className="h-2.5 bg-[var(--color-border)] rounded w-8" />
                </div>
                <div className="h-2.5 bg-[var(--color-border)] rounded w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (budgets.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-6">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-sm text-[var(--color-fg)] mb-1">
            No budgets yet
          </p>
          <p className="text-xs text-[var(--color-muted)] mb-4">
            Get started by creating your first budget.
          </p>
          <Link
            href="/budgets"
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-medium bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90 transition-opacity w-fit"
          >
            Create a Budget
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-header">Budgets</h3>
        <ViewAllLink href="/budgets" />
      </div>

      {/* Hero: remaining + spent/total caption. No overall progress
          bar — the per-row percentages communicate fullness, and the
          aggregate spent/total below the hero is the only number
          worth giving headline-adjacent weight. */}
      <div className="mb-6">
        <div className="text-4xl font-normal text-[var(--color-fg)] tracking-tight">
          <CurrencyAmount amount={remaining} />
        </div>
        <div className="text-sm text-[var(--color-muted)] font-medium mt-1">
          Remaining
        </div>
        <div className="text-[11px] text-[var(--color-muted)] tabular-nums mt-3">
          {formatCurrency(totalSpent)} spent · {formatCurrency(totalBudget)} total
        </div>
      </div>

      {/* Hairline divider separates the aggregate hero from the
          per-budget list so the eye registers them as two distinct
          beats rather than one continuous block of text. */}
      <div className="h-px bg-[var(--color-border)] mb-5" />

      <div className="mt-auto space-y-5">
        {budgets.slice(0, MAX_ROWS).map((budget) => (
          <BudgetRow key={budget.id} budget={budget} />
        ))}
      </div>
    </div>
  );
}
