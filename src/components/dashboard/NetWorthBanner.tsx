"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useNetWorth } from "../providers/NetWorthProvider";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";

export default function NetWorthBanner() {
  const { currentNetWorth, netWorthHistory, loading } = useNetWorth();

  // Calculate 30-day % change from history
  const percentChange = useMemo(() => {
    if (!netWorthHistory || netWorthHistory.length < 2) return null;
    const oldest = netWorthHistory[0];
    const newest = netWorthHistory[netWorthHistory.length - 1];
    if (!oldest?.netWorth || oldest.netWorth === 0) return null;
    return ((newest.netWorth - oldest.netWorth) / Math.abs(oldest.netWorth)) * 100;
  }, [netWorthHistory]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-2" />
        <div className="flex items-baseline gap-3 mb-6">
          <div className="h-11 w-52 bg-[var(--color-border)] rounded" />
          <div className="h-4 w-16 bg-[var(--color-border)] rounded" />
        </div>
        <div className="flex gap-6">
          <div className="h-10 w-32 bg-[var(--color-border)] rounded" />
          <div className="h-10 w-32 bg-[var(--color-border)] rounded" />
        </div>
      </div>
    );
  }

  const netWorth = currentNetWorth?.netWorth ?? 0;
  const assets = currentNetWorth?.assets ?? 0;
  const liabilities = currentNetWorth?.liabilities ?? 0;

  return (
    <Link
      href="/accounts"
      className="block cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.015] active:scale-[0.995]"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="card-header">Net Worth</div>
        <span className="text-[var(--color-muted)] text-lg leading-none">
          &#8250;
        </span>
      </div>

      {/* Number + % change */}
      <div className="flex items-baseline gap-3 mb-6">
        <div className="text-4xl font-medium text-[var(--color-fg)] tracking-tight">
          <CurrencyAmount amount={netWorth} />
        </div>
        {percentChange !== null && (
          <span className={`text-xs font-semibold ${
            percentChange >= 0 ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {percentChange >= 0 ? '▲' : '▼'} {Math.abs(percentChange).toLocaleString('en-US', { maximumFractionDigits: 1 })}%
          </span>
        )}
      </div>

      {/* Assets & Liabilities */}
      <div className="flex items-center gap-8">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Assets
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
            {formatCurrency(assets)}
          </span>
        </div>
        <div className="w-px h-8 bg-[var(--color-border)]" />
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Liabilities
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
            {formatCurrency(liabilities)}
          </span>
        </div>
      </div>
    </Link>
  );
}
