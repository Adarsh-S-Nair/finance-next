"use client";

import React, { useState, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import Link from "next/link";
import ViewAllLink from "../ui/ViewAllLink";
import { useUser } from "../providers/UserProvider";
import * as Icons from "lucide-react";

export default function BudgetsCard() {
  const { user, loading: authLoading } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) { setLoading(false); return; }
    async function fetchBudgets() {
      setLoading(true);
      try {
        const res = await authFetch(`/api/budgets`);
        const json = await res.json();
        const data = json.data || [];
        setBudgets(data);

        if (data.length === 0) {
          try {
            const spendRes = await authFetch(`/api/transactions/spending-by-category?days=120&forBudget=true&groupBy=group`);
            const spendJson = await spendRes.json();
            if (spendJson.categories?.length > 0 && spendJson.completeMonths > 0) {
              setSuggestions({
                categories: spendJson.categories.slice(0, 3),
                completeMonths: spendJson.completeMonths,
                totalSpending: spendJson.totalSpending,
              });
            }
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.error("Error fetching budgets:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchBudgets();
  }, [authLoading, user?.id]);

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0);
  const remaining = totalBudget - totalSpent;

  const formatCurrencyWithCents = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getLabel = (budget) => {
    return budget.category_groups?.name || budget.system_categories?.label || "Unknown";
  };

  // Shared: segmented bar with hover tooltips
  const SegmentedBar = ({ items, getSpent, getColor, getLabel: labelFn, totalAmount }) => (
    <div className="flex w-full gap-0.5">
      {items.map((item, i) => {
        const spent = getSpent(item);
        const segmentWidth = totalAmount > 0 ? (spent / totalAmount) * 100 : 0;
        if (segmentWidth <= 0) return null;
        return (
          <div
            key={i}
            className="relative h-2.5 rounded-sm transition-all duration-300 cursor-default"
            style={{
              width: `${segmentWidth}%`,
              backgroundColor: getColor(item) || 'var(--color-accent)',
              opacity: hoveredSegment !== null && hoveredSegment !== i ? 0.4 : 1,
            }}
            onMouseEnter={() => setHoveredSegment(i)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            {hoveredSegment === i && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] text-[11px] font-medium whitespace-nowrap z-10 pointer-events-none">
                {labelFn(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Shared: legend list
  const LegendList = ({ items, getLabel: labelFn, getAmount, getColor }) => (
    <div className="space-y-3.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getColor(item) || 'var(--color-accent)' }}
            />
            <span className="text-[13px] text-[var(--color-fg)]">{labelFn(item)}</span>
          </div>
          <span className="text-[13px] text-[var(--color-fg)] tabular-nums">
            {formatCurrencyWithCents(getAmount(item))}
          </span>
        </div>
      ))}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="animate-pulse">
          <div className="bg-[var(--color-surface-alt)] rounded-xl p-5 mb-5">
            <div className="h-7 bg-[var(--color-border)] rounded w-32 mb-1.5" />
            <div className="h-3.5 bg-[var(--color-border)] rounded w-16 mb-4" />
            <div className="flex gap-0.5">
              <div className="h-2.5 bg-[var(--color-border)] rounded-sm flex-[3]" />
              <div className="h-2.5 bg-[var(--color-border)] rounded-sm flex-[2]" />
              <div className="h-2.5 bg-[var(--color-border)] rounded-sm flex-1" />
            </div>
          </div>
          <div className="space-y-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-border)]" />
                  <div className="h-4 bg-[var(--color-border)] rounded" style={{ width: `${60 + i * 12}px` }} />
                </div>
                <div className="h-4 bg-[var(--color-border)] rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (budgets.length === 0) {
    const suggestedBudgets = suggestions?.categories?.map((cat) => {
      const monthlyAvg = cat.total_spent / suggestions.completeMonths;
      const suggestedAmount = Math.ceil(monthlyAvg / 10) * 10;
      return {
        label: cat.label,
        hexColor: cat.hex_color,
        spent: Math.round(monthlyAvg),
        amount: suggestedAmount,
        remaining: suggestedAmount - Math.round(monthlyAvg),
      };
    }) || [];

    const totalBudgetSuggested = suggestedBudgets.reduce((s, b) => s + b.amount, 0);
    const remainingSuggested = totalBudgetSuggested - suggestedBudgets.reduce((s, b) => s + b.spent, 0);
    const hasSuggestions = suggestedBudgets.length > 0;

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header">Budgets</h3>
        </div>

        {hasSuggestions ? (
          <div className="flex-1 flex flex-col">
            {/* Hero card */}
            <div className="bg-[var(--color-surface-alt)] rounded-xl p-5 mb-5">
              <p className="text-2xl font-light text-[var(--color-fg)] tabular-nums tracking-tight">
                {formatCurrencyWithCents(remainingSuggested)}
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-4">Remaining</p>
              <SegmentedBar
                items={suggestedBudgets}
                getSpent={(b) => b.spent}
                getColor={(b) => b.hexColor}
                getLabel={(b) => b.label}
                totalAmount={totalBudgetSuggested}
              />
            </div>

            {/* Legend */}
            <LegendList
              items={suggestedBudgets}
              getLabel={(b) => b.label}
              getAmount={(b) => b.remaining}
              getColor={(b) => b.hexColor}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
              <Icons.PiggyBank size={20} className="text-[var(--color-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-fg)] mb-1">
              No budgets yet
            </p>
            <p className="text-xs text-[var(--color-muted)] mb-4 max-w-[200px]">
              Create budgets to track spending against your goals.
            </p>
            <Link
              href="/budgets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90 transition-opacity"
            >
              Create Budget
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Normal state
  const displayBudgets = budgets.slice(0, 3);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header">Budgets</h3>
        <ViewAllLink href="/budgets" />
      </div>

      {/* Hero card */}
      <div className="bg-[var(--color-surface-alt)] rounded-xl p-5 mb-5">
        <p className="text-2xl font-light text-[var(--color-fg)] tabular-nums tracking-tight">
          {formatCurrencyWithCents(remaining)}
        </p>
        <p className="text-xs text-[var(--color-muted)] mb-4">Remaining</p>
        <SegmentedBar
          items={displayBudgets}
          getSpent={(b) => Number(b.spent || 0)}
          getColor={(b) => b.category_groups?.hex_color}
          getLabel={getLabel}
          totalAmount={totalBudget}
        />
      </div>

      {/* Legend */}
      <LegendList
        items={displayBudgets}
        getLabel={getLabel}
        getAmount={(b) => b.remaining || 0}
        getColor={(b) => b.category_groups?.hex_color}
      />
    </div>
  );
}
