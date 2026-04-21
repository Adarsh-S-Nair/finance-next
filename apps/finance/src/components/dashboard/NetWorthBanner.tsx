"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useNetWorth } from "../providers/NetWorthProvider";
import { useAccounts } from "../providers/AccountsProvider";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";
import { SegmentedTabs } from "@zervo/ui";
function categorizeAccount(account: { type?: string; subtype?: string }) {
  const t = `${account.type || ""} ${account.subtype || ""}`.toLowerCase();
  const liabilityKeywords = ["credit", "loan", "mortgage", "line of credit", "overdraft"];
  const investmentKeywords = [
    "investment", "brokerage", "401k", "ira", "retirement",
    "mutual fund", "stock", "bond",
  ];
  if (liabilityKeywords.some((k) => t.includes(k))) {
    return t.includes("loan") || t.includes("mortgage") || t.includes("line of credit")
      ? "loans" : "credit";
  }
  if (investmentKeywords.some((k) => t.includes(k))) return "investments";
  return "cash";
}

interface MiniBarProps {
  label: string;
  total: number;
  segments: { label: string; amount: number; color: string }[];
}

export type NetWorthMock = {
  netWorth: number;
  percentChange: number | null;
  breakdown: {
    totalAssets: number;
    totalLiabilities: number;
    assetSegments: { label: string; amount: number; color: string }[];
    liabilitySegments: { label: string; amount: number; color: string }[];
  };
};

interface NetWorthBannerProps {
  mockData?: NetWorthMock;
}

function MiniBar({ label, total, segments }: MiniBarProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs font-semibold text-[var(--color-fg)] tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>

      {/* Bar */}
      <div className="w-full h-3 flex rounded-full overflow-hidden bg-[var(--color-surface-alt)] mb-3">
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.amount / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={seg.label}
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-[11px] text-[var(--color-muted)]">
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NetWorthBanner({ mockData }: NetWorthBannerProps = {}) {
  const { currentNetWorth, netWorthHistory, loading } = useNetWorth();
  const { allAccounts, loading: accountsLoading } = useAccounts();
  const [mobileTab, setMobileTab] = useState<'assets' | 'liabilities'>('assets');

  const livePercentChange = useMemo(() => {
    if (!netWorthHistory || netWorthHistory.length < 2) return null;
    const oldest = netWorthHistory[0];
    const newest = netWorthHistory[netWorthHistory.length - 1];
    if (!oldest?.netWorth || oldest.netWorth === 0) return null;
    return ((newest.netWorth - oldest.netWorth) / Math.abs(oldest.netWorth)) * 100;
  }, [netWorthHistory]);

  const liveBreakdown = useMemo(() => {
    if (accountsLoading || !allAccounts) return null;
    const totals = { cash: 0, investments: 0, credit: 0, loans: 0 };
    for (const acc of allAccounts) {
      const cat = categorizeAccount(acc);
      totals[cat] += Math.abs(acc.balance);
    }
    return {
      totalAssets: totals.cash + totals.investments,
      totalLiabilities: totals.credit + totals.loans,
      assetSegments: [
        { label: "Cash", amount: totals.cash, color: "#059669" },
        { label: "Investments", amount: totals.investments, color: "var(--color-neon-green)" },
      ],
      liabilitySegments: [
        { label: "Credit", amount: totals.credit, color: "#ef4444" },
        { label: "Loans", amount: totals.loans, color: "#b91c1c" },
      ],
    };
  }, [allAccounts, accountsLoading]);

  const percentChange = mockData ? mockData.percentChange : livePercentChange;
  const breakdown = mockData ? mockData.breakdown : liveBreakdown;

  if (!mockData && loading) {
    return (
      <div className="animate-pulse">
        <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-2" />
        <div className="flex items-baseline gap-3 mb-6">
          <div className="h-11 w-52 bg-[var(--color-border)] rounded" />
          <div className="h-4 w-16 bg-[var(--color-border)] rounded" />
        </div>
        <div className="flex gap-8">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-full bg-[var(--color-border)] rounded" />
            <div className="h-3 w-full bg-[var(--color-border)] rounded-full" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-full bg-[var(--color-border)] rounded" />
            <div className="h-3 w-full bg-[var(--color-border)] rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const netWorth = mockData ? mockData.netWorth : (currentNetWorth?.netWorth ?? 0);

  const headerBlock = (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="card-header">Net Worth</div>
        {!mockData && (
          <span className="text-[var(--color-muted)] text-lg leading-none">
            &#8250;
          </span>
        )}
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
    </>
  );

  return (
    <div>
      {mockData ? (
        <div>{headerBlock}</div>
      ) : (
        <Link
          href="/accounts"
          className="block cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.015] active:scale-[0.995]"
        >
          {headerBlock}
        </Link>
      )}

      {/* Assets & Liabilities breakdown — side-by-side on desktop, tabbed on mobile */}
      {breakdown && (
        <>
          {/* Desktop: both side by side */}
          <div className="hidden md:flex items-start gap-8">
            <MiniBar
              label="Assets"
              total={breakdown.totalAssets}
              segments={breakdown.assetSegments}
            />
            <MiniBar
              label="Liabilities"
              total={breakdown.totalLiabilities}
              segments={breakdown.liabilitySegments}
            />
          </div>

          {/* Mobile: tabbed toggle */}
          <div className="md:hidden">
            <div className="mb-4">
              <SegmentedTabs
                size="xs"
                value={mobileTab}
                onChange={(v: string) => setMobileTab(v as 'assets' | 'liabilities')}
                options={[
                  { label: 'Assets', value: 'assets' },
                  { label: 'Liabilities', value: 'liabilities' },
                ]}
              />
            </div>
            {mobileTab === 'assets' ? (
              <MiniBar
                label="Assets"
                total={breakdown.totalAssets}
                segments={breakdown.assetSegments}
              />
            ) : (
              <MiniBar
                label="Liabilities"
                total={breakdown.totalLiabilities}
                segments={breakdown.liabilitySegments}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
