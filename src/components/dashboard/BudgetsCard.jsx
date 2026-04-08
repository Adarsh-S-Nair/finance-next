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

        // If no budgets, fetch spending data for suggestions
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
          } catch { /* ignore - we'll show a simpler empty state */ }
        }
      } catch (e) {
        console.error("Error fetching budgets:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchBudgets();
  }, [authLoading, user?.id]);

  // Calculate aggregate totals
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

  // Get label for a budget
  const getLabel = (budget) => {
    return budget.category_groups?.name || budget.system_categories?.label || "Unknown";
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="border border-[var(--color-border)] rounded-xl px-5 py-5">
            <div className="h-7 bg-[var(--color-border)] rounded w-32 mx-auto" />
          </div>
          <div className="h-2 bg-[var(--color-border)] rounded-full" />
          <div className="space-y-2.5 pt-1">
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
    const totalSpentSuggested = suggestedBudgets.reduce((s, b) => s + b.spent, 0);
    const remainingSuggested = totalBudgetSuggested - totalSpentSuggested;
    const hasSuggestions = suggestedBudgets.length > 0;

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header">Budgets</h3>
        </div>

        {hasSuggestions ? (
          <div className="flex-1 flex flex-col">
            {/* Hero Number Container */}
            <div className="border border-[var(--color-border)] rounded-xl px-5 py-4 mb-4">
              <p className="text-center text-2xl font-semibold text-[var(--color-fg)] tabular-nums tracking-tight">
                {formatCurrencyWithCents(remainingSuggested)}
              </p>
            </div>

            {/* Multi-Segment Progress Bar */}
            <div className="h-2 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden flex mb-5">
              {suggestedBudgets.map((budget, i) => {
                const segmentWidth = totalBudgetSuggested > 0
                  ? (budget.spent / totalBudgetSuggested) * 100
                  : 0;
                return (
                  <div
                    key={i}
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${segmentWidth}%`,
                      backgroundColor: budget.hexColor || 'var(--color-accent)',
                      borderRadius: suggestedBudgets.length === 1 ? '9999px'
                        : i === 0 ? '9999px 0 0 9999px'
                        : i === suggestedBudgets.length - 1 ? '0 9999px 9999px 0'
                        : '0',
                    }}
                  />
                );
              })}
            </div>

            {/* Legend List */}
            <div className="space-y-2.5">
              {suggestedBudgets.map((budget, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: budget.hexColor || 'var(--color-accent)' }}
                    />
                    <span className="text-sm font-medium text-[var(--color-fg)]">{budget.label}</span>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                    {formatCurrencyWithCents(budget.remaining)}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer with Total + CTA */}
            <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[var(--color-fg)]">Total</span>
                <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
                  {formatCurrencyWithCents(totalBudgetSuggested)}
                </span>
              </div>
              <Link
                href="/budgets"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90 transition-opacity"
              >
                Set Up Budgets
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header">Budgets</h3>
        <ViewAllLink href="/budgets" />
      </div>

      {/* Hero Number Container */}
      <div className="border border-[var(--color-border)] rounded-xl px-5 py-4 mb-4">
        <p className="text-center text-2xl font-semibold text-[var(--color-fg)] tabular-nums tracking-tight">
          {formatCurrencyWithCents(remaining)}
        </p>
      </div>

      {/* Multi-Segment Progress Bar */}
      <div className="h-2 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden flex mb-5">
        {budgets.slice(0, 3).map((budget, i) => {
          const segmentWidth = totalBudget > 0
            ? (Number(budget.spent || 0) / totalBudget) * 100
            : 0;
          const count = Math.min(budgets.length, 3);
          return (
            <div
              key={budget.id}
              className="h-full transition-all duration-500"
              style={{
                width: `${segmentWidth}%`,
                backgroundColor: budget.category_groups?.hex_color || 'var(--color-accent)',
                borderRadius: count === 1 ? '9999px'
                  : i === 0 ? '9999px 0 0 9999px'
                  : i === count - 1 ? '0 9999px 9999px 0'
                  : '0',
              }}
            />
          );
        })}
      </div>

      {/* Budget Legend List */}
      <div className="space-y-2.5">
        {budgets.slice(0, 3).map((budget) => (
          <div key={budget.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: budget.category_groups?.hex_color || 'var(--color-accent)' }}
              />
              <span className="text-sm font-medium text-[var(--color-fg)]">{getLabel(budget)}</span>
            </div>
            <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
              {formatCurrencyWithCents(budget.remaining || 0)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Total */}
      <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-fg)]">Total</span>
          <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
            {formatCurrencyWithCents(totalBudget)}
          </span>
        </div>
      </div>
    </div>
  );
}
