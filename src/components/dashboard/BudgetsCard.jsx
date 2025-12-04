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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l8-4 8 4v14M10 10v4M14 10v4" />
          </svg>
        );
      case 'bill':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 2v20M2 12h20" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="h-full">
      <div className="flex flex-col h-full">
        {/* Header */}
        <h3 className="text-sm font-medium text-[var(--color-muted)] mb-4">January Budget</h3>

        {/* Hero Section */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-[var(--color-fg)]">{formatCurrency(totalBudget)}</span>
            <span className="text-xs text-[var(--color-muted)]">of {formatCurrency(totalSpent)} spent</span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full bg-[var(--color-bg)] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out bg-[#4ade80]"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Status Message */}
          <p className="text-xs">
            <span className="text-[var(--color-fg)]">Great job! You have </span>
            <span className="font-bold text-[#4ade80]">{formatCurrency(remaining)} left.</span>
          </p>
        </div>

        {/* Top Monthly Budgets List */}
        <div className="mt-auto">
          <h4 className="text-xs font-medium text-[var(--color-muted)] mb-3 uppercase tracking-wider">Top Monthly Budgets</h4>

          <div className="space-y-3">
            {budgets.map((item, index) => (
              <div key={index} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-muted)]">
                    {renderIcon(item.icon)}
                  </div>
                  <span className="text-xs font-normal text-[var(--color-fg)]">{item.category}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-fg)]">{formatCurrencyWithCents(item.amount)}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
