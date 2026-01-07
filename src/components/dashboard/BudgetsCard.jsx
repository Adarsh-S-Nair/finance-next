"use client";

import React from "react";
import Card from "../ui/Card";

export default function BudgetsCard() {
  // Mock Data matching the screenshot style
  const totalBudget = 448;
  const totalSpent = 251;
  const remaining = totalBudget - totalSpent;
  const percentage = Math.min(100, (totalSpent / totalBudget) * 100);

  const budgets = [
    { category: "Financial", amount: 258.00, icon: "bank" },
    { category: "Bills & Utilities", amount: 100.00, icon: "bill" },
  ];

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

  const renderIcon = (type) => {
    switch (type) {
      case 'bank':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l8-4 8 4v14M10 10v4M14 10v4" />
          </svg>
        );
      case 'bill':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 2v20M2 12h20" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="card-header">Budgets</h3>
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
            className="h-full rounded-full transition-all duration-500 ease-out bg-[var(--color-accent)]"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between text-xs font-medium text-[var(--color-muted)] mt-2">
          <span>{formatCurrency(totalSpent)} spent</span>
          <span>{formatCurrency(totalBudget)} total</span>
        </div>
      </div>

      {/* Minimal List */}
      <div className="mt-auto space-y-4">
        {budgets.map((item, index) => (
          <div key={index} className="flex items-center justify-between group cursor-pointer hover:bg-[var(--color-surface-hover)] -mx-2 px-2 py-1.5 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                {renderIcon(item.icon)}
              </div>
              <span className="text-sm font-medium text-[var(--color-fg)]">{item.category}</span>
            </div>
            <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
              {formatCurrencyWithCents(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
