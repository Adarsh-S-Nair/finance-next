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
      <div className="flex items-center justify-between animate-pulse">
        <div>
          <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-2" />
          <div className="h-8 w-36 bg-[var(--color-border)] rounded" />
        </div>
      </div>
    );
  }

  const netWorth = currentNetWorth?.netWorth ?? 0;

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="card-header mb-1">Net Worth</div>
        <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight">
          {formatCurrency(netWorth)}
        </div>
      </div>
      <Link
        href="/accounts"
        className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors text-lg"
        title="View accounts"
      >
        &#8250;
      </Link>
    </div>
  );
}
