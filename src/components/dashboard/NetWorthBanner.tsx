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
      <div className="glass-panel rounded-2xl p-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-3" />
            <div className="h-9 w-44 bg-[var(--color-border)] rounded mb-3" />
            <div className="flex gap-6">
              <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
              <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const netWorth = currentNetWorth?.netWorth ?? 0;
  const assets = currentNetWorth?.assets ?? 0;
  const liabilities = currentNetWorth?.liabilities ?? 0;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="card-header mb-2">Net Worth</div>
          <div className="text-3xl font-semibold text-[var(--color-fg)] tracking-tight mb-2">
            {formatCurrency(netWorth)}
          </div>
          <div className="flex gap-6 text-xs text-[var(--color-muted)]">
            <span>Assets {formatCurrency(assets)}</span>
            <span>Liabilities {formatCurrency(liabilities)}</span>
          </div>
        </div>
        <Link
          href="/accounts"
          className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors text-xl leading-none"
          title="View accounts"
        >
          &#8250;
        </Link>
      </div>
    </div>
  );
}
