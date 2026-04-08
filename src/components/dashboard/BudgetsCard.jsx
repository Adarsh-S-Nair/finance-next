"use client";

import React, { useState, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import Link from "next/link";
import ViewAllLink from "../ui/ViewAllLink";
import { useUser } from "../providers/UserProvider";
import DynamicIcon from "../DynamicIcon";
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
  const percentage = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyWithCents = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-[var(--color-border)] rounded w-24" />
          <div className="h-1.5 bg-[var(--color-border)] rounded-full" />
          <div className="space-y-3 mt-6">
            <div className="h-8 bg-[var(--color-border)] rounded" />
            <div className="h-8 bg-[var(--color-border)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Empty state - show suggested budget preview based on spending
  if (budgets.length === 0) {
    // Build suggested budget amounts from spending data
    const suggestedBudgets = suggestions?.categories?.map((cat) => {
      const monthlyAvg = cat.total_spent / suggestions.completeMonths;
      // Round up to nearest $10 to give a comfortable buffer
      const suggestedAmount = Math.ceil(monthlyAvg / 10) * 10;
      return {
        label: cat.label,
        iconLib: cat.icon_lib,
        iconName: cat.icon_name,
        hexColor: cat.hex_color,
        spent: Math.round(monthlyAvg),
        amount: suggestedAmount,
        remaining: suggestedAmount - Math.round(monthlyAvg),
        percentage: Math.min(100, (monthlyAvg / suggestedAmount) * 100),
      };
    }) || [];

    const totalBudgetSuggested = suggestedBudgets.reduce((s, b) => s + b.amount, 0);
    const totalSpentSuggested = suggestedBudgets.reduce((s, b) => s + b.spent, 0);
    const remainingSuggested = totalBudgetSuggested - totalSpentSuggested;
    const percentageSuggested = totalBudgetSuggested > 0 ? Math.min(100, (totalSpentSuggested / totalBudgetSuggested) * 100) : 0;

    const hasSuggestions = suggestedBudgets.length > 0;

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Budgets</h3>
        </div>

        {hasSuggestions ? (
          <div className="flex-1 flex flex-col relative">
            {/* Suggested budget preview - mirrors real layout but dimmed */}
            <div className="opacity-50 pointer-events-none select-none">
              {/* Hero Section */}
              <div className="mb-8">
                <div className="flex flex-col gap-1 mb-4">
                  <span className="text-4xl font-semibold text-[var(--color-fg)] tracking-tight">
                    {formatCurrency(remainingSuggested)}
                  </span>
                  <span className="text-sm text-[var(--color-muted)] font-medium">
                    Remaining
                  </span>
                </div>

                <div className="h-1.5 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${percentageSuggested}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs font-medium text-[var(--color-muted)] mt-2">
                  <span>{formatCurrency(totalSpentSuggested)} spent</span>
                  <span>{formatCurrency(totalBudgetSuggested)} total</span>
                </div>
              </div>

              {/* Suggested budget list */}
              <div className="space-y-4">
                {suggestedBudgets.map((budget, i) => (
                  <div key={i} className="flex items-center justify-between -mx-2 px-2 py-1.5">
                    <div className="flex items-center gap-3">
                      <div className="text-[var(--color-muted)]">
                        <DynamicIcon iconLib={budget.iconLib} iconName={budget.iconName} className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-[var(--color-fg)]">{budget.label}</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                      {formatCurrencyWithCents(budget.remaining)} left
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlay CTA */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-card-bg)]/60 backdrop-blur-[2px] rounded-lg">
              <p className="text-sm font-medium text-[var(--color-fg)] mb-1">
                Based on your spending
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-4 text-center px-4">
                We suggest {suggestedBudgets.length} budget{suggestedBudgets.length !== 1 ? 's' : ''} totaling {formatCurrency(totalBudgetSuggested)}/mo
              </p>
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
          /* Fallback if no spending data available */
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-sm text-[var(--color-fg)] mb-1">
              No budgets yet
            </p>
            <p className="text-xs text-[var(--color-muted)] mb-4">
              Get started by creating your first budget.
            </p>
            <Link
              href="/budgets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90 transition-opacity w-fit"
            >
              Create a Budget
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Get icon component for a budget
  const getIcon = (budget) => {
    const iconName = budget.category_groups?.icon_name;
    const IconComponent = iconName && Icons[iconName] ? Icons[iconName] : Icons.Wallet;
    return <IconComponent size={16} />;
  };

  // Get label for a budget
  const getLabel = (budget) => {
    return budget.category_groups?.name || budget.system_categories?.label || "Unknown";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-header">Budgets</h3>
        <ViewAllLink href="/budgets" />
      </div>

      {/* Hero Section - Focus on Remaining */}
      <div className="mb-8">
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-4xl font-semibold text-[var(--color-fg)] tracking-tight">
            {formatCurrency(remaining)}
          </span>
          <span className="text-sm text-[var(--color-muted)] font-medium">
            Remaining
          </span>
        </div>

        {/* Minimal Progress Bar */}
        <div className="h-1.5 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${percentage >= 100 ? 'bg-rose-500' : percentage > 85 ? 'bg-amber-500' : 'bg-[var(--color-accent)]'
              }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between text-xs font-medium text-[var(--color-muted)] mt-2">
          <span>{formatCurrency(totalSpent)} spent</span>
          <span>{formatCurrency(totalBudget)} total</span>
        </div>
      </div>

      {/* Budget List */}
      <div className="mt-auto space-y-4">
        {budgets.slice(0, 3).map((budget) => (
          <div key={budget.id} className="flex items-center justify-between group cursor-pointer hover:bg-[var(--color-surface-alt)] -mx-2 px-2 py-1.5 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                {getIcon(budget)}
              </div>
              <span className="text-sm font-medium text-[var(--color-fg)]">{getLabel(budget)}</span>
            </div>
            <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
              {formatCurrencyWithCents(budget.remaining || 0)} left
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
