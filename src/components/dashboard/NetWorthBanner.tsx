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
        <div className="flex items-baseline gap-3 mb-5">
          <div className="h-11 w-52 bg-[var(--color-border)] rounded" />
          <div className="h-4 w-16 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-2.5 w-full bg-[var(--color-border)] rounded-full mb-3" />
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
      <div className="flex items-baseline gap-3 mb-5">
        <div className="text-4xl font-medium text-[var(--color-fg)] tracking-tight">
          <CurrencyAmount amount={netWorth} />
        </div>
        {percentChange !== null && (
          <span className={`text-xs font-semibold ${
            percentChange >= 0 ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {percentChange >= 0 ? '▲' : '▼'} {Math.abs(percentChange).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Segmented bar */}
      <div className="w-full flex gap-1 mb-3">
        {assets > 0 && (
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${assetsPct}%`, backgroundColor: "#059669" }}
          />
        )}
        {liabilities > 0 && (
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${liabilitiesPct}%`, backgroundColor: "#ef4444" }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted)]">
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
    </Link>
  );
}
