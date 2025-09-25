"use client";

import React from "react";
import Card from "../ui/Card";
import { useUser } from "../UserProvider";
import { useNetWorth } from "../NetWorthProvider";

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function NetWorthSummaryCard() {
  const { profile } = useUser();
  const { currentNetWorth, loading, error } = useNetWorth();

  if (loading) {
    return (
      <Card width="1/2">
        <div className="animate-pulse">
          <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-2" />
          <div className="h-8 bg-[var(--color-border)] rounded w-32 mb-6" />
          <div className="h-3 bg-[var(--color-border)] rounded w-full mb-4" />
          <div className="space-y-2">
            <div className="h-4 bg-[var(--color-border)] rounded w-24" />
            <div className="h-4 bg-[var(--color-border)] rounded w-20" />
          </div>
        </div>
      </Card>
    );
  }

  if (error || !currentNetWorth) {
    return (
      <Card width="1/2">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
          <div className="text-2xl font-semibold text-[var(--color-fg)]">
            {error ? 'Unable to load' : 'No data'}
          </div>
        </div>
        <div className="h-3 bg-[var(--color-border)] rounded w-full mb-4" />
        <div className="space-y-2">
          <div className="text-sm text-[var(--color-muted)]">
            Assets: {error ? '--' : '$0'}
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            Liabilities: {error ? '--' : '$0'}
          </div>
        </div>
      </Card>
    );
  }

  const netWorth = currentNetWorth.netWorth || 0;
  const assets = currentNetWorth.assets || 0;
  const liabilities = currentNetWorth.liabilities || 0;
  
  // Calculate percentages for the segmented bar
  const total = assets + liabilities;
  const assetsPercentage = total > 0 ? (assets / total) * 100 : 0;
  const liabilitiesPercentage = total > 0 ? (liabilities / total) * 100 : 0;

  // Get accent color from profile or CSS variable
  const accentColor = profile?.accent_color || (typeof window !== 'undefined' ? 
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() : 
    '#484444'
  );

  return (
    <Card width="1/2">
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
        <div className="text-2xl font-semibold text-[var(--color-fg)]">
          {formatCurrency(netWorth)}
        </div>
      </div>
      
      {/* Segmented Bar */}
      <div className="mb-6">
        <div className="h-3 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div className="h-full flex">
            {assets > 0 && (
              <div 
                className="transition-all duration-300"
                style={{ 
                  width: `${assetsPercentage}%`,
                  backgroundColor: accentColor,
                  opacity: 0.8
                }}
              />
            )}
            {liabilities > 0 && (
              <div 
                className="transition-all duration-300"
                style={{ 
                  width: `${liabilitiesPercentage}%`,
                  backgroundColor: accentColor,
                  opacity: 0.4
                }}
              />
            )}
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: accentColor, opacity: 0.8 }}
            ></div>
            <span className="text-sm text-[var(--color-muted)]">Assets</span>
          </div>
          <span className="text-sm font-medium text-[var(--color-fg)]">
            {formatCurrency(assets)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: accentColor, opacity: 0.4 }}
            ></div>
            <span className="text-sm text-[var(--color-muted)]">Liabilities</span>
          </div>
          <span className="text-sm font-medium text-[var(--color-fg)]">
            {formatCurrency(liabilities)}
          </span>
        </div>
      </div>
    </Card>
  );
}
