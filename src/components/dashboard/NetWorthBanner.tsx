"use client";

import React from "react";
import Link from "next/link";
import { useNetWorth } from "../providers/NetWorthProvider";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function NetWorthBanner() {
  const { currentNetWorth, loading } = useNetWorth();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-2" />
        <div className="h-9 w-44 bg-[var(--color-border)] rounded mb-4" />
        <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full mb-3" />
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
          <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
        </div>
      </div>
    );
  }

  const netWorth = currentNetWorth?.netWorth ?? 0;
  const assets = currentNetWorth?.assets ?? 0;
  const liabilities = currentNetWorth?.liabilities ?? 0;
  const total = assets + liabilities;
  const assetsPct = total > 0 ? (assets / total) * 100 : 100;
  const liabilitiesPct = total > 0 ? (liabilities / total) * 100 : 0;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="card-header">Net Worth</div>
        <Link
          href="/accounts"
          className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors text-lg leading-none"
          title="View accounts"
        >
          &#8250;
        </Link>
      </div>

      {/* Number */}
      <div className="text-3xl font-semibold text-[var(--color-fg)] tracking-tight mb-4">
        {formatCurrency(netWorth)}
      </div>

      {/* Segmented bar — two separate segments with a gap */}
      <div className="w-full flex gap-1 mb-3">
        {assets > 0 && (
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${assetsPct}%`, backgroundColor: "#059669" }}
          />
        )}
        {liabilities > 0 && (
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${liabilitiesPct}%`, backgroundColor: "#ef4444" }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#059669" }} />
          <span>Assets</span>
          <span className="text-[var(--color-fg)] font-medium tabular-nums ml-1">
            {formatCurrency(assets)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
          <span>Liabilities</span>
          <span className="text-[var(--color-fg)] font-medium tabular-nums ml-1">
            {formatCurrency(liabilities)}
          </span>
        </div>
      </div>
    </div>
  );
}
