"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Card from "../ui/Card";
import { useUser } from "../UserProvider";
import * as Icons from "lucide-react";

export default function BudgetsCard() {
  const { user } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBudgets() {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/budgets?userId=${user.id}`);
        const json = await res.json();
        setBudgets(json.data || []);
      } catch (e) {
        console.error("Error fetching budgets:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchBudgets();
  }, [user?.id]);

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
      <Card className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="card-header">Budgets</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-[var(--color-surface-hover)] rounded w-24" />
          <div className="h-1.5 bg-[var(--color-surface-hover)] rounded-full" />
          <div className="space-y-3 mt-6">
            <div className="h-8 bg-[var(--color-surface-hover)] rounded" />
            <div className="h-8 bg-[var(--color-surface-hover)] rounded" />
          </div>
        </div>
      </Card>
    );
  }

  // Empty state - clean with prominent CTA
  if (budgets.length === 0) {
    return (
      <Card className="h-full flex flex-col">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity w-fit"
          >
            Create a Budget
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </Card>
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
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-header">Budgets</h3>
        <Link href="/budgets" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors">
          View all
        </Link>
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
        <div className="h-1.5 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden mb-2">
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
          <div key={budget.id} className="flex items-center justify-between group cursor-pointer hover:bg-[var(--color-surface-hover)] -mx-2 px-2 py-1.5 rounded-lg transition-colors">
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
    </Card>
  );
}
