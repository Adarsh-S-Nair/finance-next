"use client";

import React, { useState, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import Link from "next/link";
import { useUser } from "../providers/UserProvider";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";
import DynamicIcon from "../DynamicIcon";
import { FiTag } from "react-icons/fi";
import { ViewAllLink } from "@zervo/ui";

const MAX_ROWS = 3;

// Color the per-budget bar by how close it is to the cap. Under 85% uses the
// category's own color; past that we shift to amber/rose so the user notices
// without having to read percentages.
const barColorFor = (percentage, hex) => {
  if (percentage >= 100) return "#f43f5e"; // rose-500
  if (percentage >= 85) return "#f59e0b"; // amber-500
  return hex || "var(--color-accent)";
};

function BudgetRow({ budget }) {
  const iconLib = budget.category_groups?.icon_lib;
  const iconName = budget.category_groups?.icon_name;
  const hex =
    budget.category_groups?.hex_color ||
    budget.system_categories?.hex_color ||
    null;
  const label =
    budget.category_groups?.name ||
    budget.system_categories?.label ||
    "Unknown";

  const total = Number(budget.amount) || 0;
  const spent = Number(budget.spent) || 0;
  const percentage = Number(budget.percentage) || 0;
  const widthPct = Math.min(100, percentage);
  const barColor = barColorFor(percentage, hex);
  const pctDisplay = Math.round(percentage);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: hex || "var(--color-accent)" }}
        >
          <DynamicIcon
            iconLib={iconLib}
            iconName={iconName}
            className="h-3.5 w-3.5 text-white"
            style={{ strokeWidth: 2.5 }}
            fallback={FiTag}
          />
        </div>
        <span className="text-sm font-medium text-[var(--color-fg)] truncate flex-1">
          {label}
        </span>
        <span
          className="text-[11px] tabular-nums font-semibold flex-shrink-0"
          style={{ color: barColor }}
        >
          {pctDisplay}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${widthPct}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex items-baseline justify-between text-[11px] tabular-nums">
        <span className="text-[var(--color-fg)] font-medium">
          {formatCurrency(spent)}
        </span>
        <span className="text-[var(--color-muted)]">
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
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overallBarColor = barColorFor(overallPct, null);

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-[var(--color-border)] rounded w-24 mb-3" />
          <div className="h-2 bg-[var(--color-border)] rounded-full mb-2.5" />
          <div className="flex justify-between mb-8">
            <div className="h-2.5 bg-[var(--color-border)] rounded w-16" />
            <div className="h-2.5 bg-[var(--color-border)] rounded w-16" />
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-border)]" />
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

      <div className="mb-8">
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-4xl font-normal text-[var(--color-fg)] tracking-tight">
            <CurrencyAmount amount={remaining} />
          </span>
          <span className="text-sm text-[var(--color-muted)] font-medium">
            Remaining
          </span>
        </div>

        <div className="h-2 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden mb-2.5">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(100, overallPct)}%`,
              backgroundColor: overallBarColor,
            }}
          />
        </div>

        <div className="flex justify-between text-xs font-medium text-[var(--color-muted)]">
          <span>{formatCurrency(totalSpent)} spent</span>
          <span>{formatCurrency(totalBudget)} total</span>
        </div>
      </div>

      <div className="mt-auto space-y-6">
        {budgets.slice(0, MAX_ROWS).map((budget) => (
          <BudgetRow key={budget.id} budget={budget} />
        ))}
      </div>
    </div>
  );
}
