"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";
import { SegmentedTabs } from "@zervo/ui";

const MAX_ROWS = 6;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Same-day-of-month window for prior-month comparison: if today is Apr 22,
// prior = Mar 1 to Mar 22. Apples-to-apples; avoids the "you've spent less
// because the month isn't over" false signal.
function getComparisonDateRanges() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const pad = (n) => String(n).padStart(2, "0");

  const currentStart = `${year}-${pad(month + 1)}-01`;
  const currentEnd = `${year}-${pad(month + 1)}-${pad(day)}`;

  const priorMonthDate = new Date(year, month - 1, 1);
  const priorYear = priorMonthDate.getFullYear();
  const priorMonth = priorMonthDate.getMonth();
  const daysInPriorMonth = new Date(priorYear, priorMonth + 1, 0).getDate();
  const priorEndDay = Math.min(day, daysInPriorMonth);
  const priorStart = `${priorYear}-${pad(priorMonth + 1)}-01`;
  const priorEnd = `${priorYear}-${pad(priorMonth + 1)}-${pad(priorEndDay)}`;

  return {
    currentStart,
    currentEnd,
    priorStart,
    priorEnd,
    priorMonthLabel: MONTH_NAMES[priorMonth],
  };
}

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [priorCategories, setPriorCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [priorTotalSpending, setPriorTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [viewMode, setViewMode] = useState("thisMonth"); // 'thisMonth' | 'changes'

  const viewOptions = [
    { label: "This Month", value: "thisMonth" },
    { label: "Changes", value: "changes" },
  ];

  const dateRanges = useMemo(() => getComparisonDateRanges(), []);

  useEffect(() => {
    // Prefetched data covers the default view only.
    if (externalData && viewMode === "thisMonth") {
      setCategories((externalData.categories || []).slice(0, 20));
      setTotalSpending(externalData.totalSpending || 0);
      setLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        const currentUrl = `/api/transactions/spending-by-category?startDate=${dateRanges.currentStart}&endDate=${dateRanges.currentEnd}`;

        if (viewMode === "changes") {
          // Fetch both windows in parallel so we can compute movers.
          const priorUrl = `/api/transactions/spending-by-category?startDate=${dateRanges.priorStart}&endDate=${dateRanges.priorEnd}`;
          const [curRes, priorRes] = await Promise.all([
            authFetch(currentUrl),
            authFetch(priorUrl),
          ]);
          if (!curRes.ok || !priorRes.ok) throw new Error("Failed to fetch data");
          const [curData, priorData] = await Promise.all([curRes.json(), priorRes.json()]);
          setCategories((curData.categories || []).slice(0, 20));
          setTotalSpending(curData.totalSpending || 0);
          setPriorCategories(priorData.categories || []);
          setPriorTotalSpending(priorData.totalSpending || 0);
        } else {
          const res = await authFetch(currentUrl);
          if (!res.ok) throw new Error("Failed to fetch data");
          const data = await res.json();
          setCategories((data.categories || []).slice(0, 20));
          setTotalSpending(data.totalSpending || 0);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [
    authLoading,
    user?.id,
    viewMode,
    externalData,
    dateRanges.currentStart,
    dateRanges.currentEnd,
    dateRanges.priorStart,
    dateRanges.priorEnd,
  ]);

  // Rows differ by mode:
  //  - thisMonth: top N categories by total, with a collapsed "Other" tail
  //  - changes:   top N categories by abs(delta vs prior), no "Other" roll-up
  //               (mixing a delta with a sum-of-tails is meaningless)
  const rows = useMemo(() => {
    if (viewMode === "changes") {
      if (!categories.length && !priorCategories.length) return [];
      const priorById = new Map(
        priorCategories.map((c) => [c.id, c.total_spent || 0])
      );
      const currentById = new Map(
        categories.map((c) => [c.id, { cat: c, amount: c.total_spent || 0 }])
      );
      const allIds = new Set([
        ...currentById.keys(),
        ...priorById.keys(),
      ]);
      const merged = [];
      for (const id of allIds) {
        const current = currentById.get(id);
        const prior = priorById.get(id) || 0;
        const amount = current?.amount || 0;
        const delta = amount - prior;
        if (amount === 0 && prior === 0) continue;
        merged.push({
          id,
          label: current?.cat?.label || priorCategories.find((p) => p.id === id)?.label || "Unknown",
          color: current?.cat?.hex_color || priorCategories.find((p) => p.id === id)?.hex_color || "var(--color-fg)",
          amount,
          prior,
          delta,
        });
      }
      merged.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      return merged.slice(0, MAX_ROWS).map((m, i) => ({ ...m, rank: i }));
    }

    // thisMonth mode
    if (!categories.length) return [];
    const namedCount = MAX_ROWS - 1;
    const named = categories.slice(0, namedCount).map((cat, i) => ({
      id: cat.id,
      label: cat.label,
      amount: cat.total_spent,
      color: cat.hex_color || "var(--color-fg)",
      rank: i,
    }));
    const namedSum = named.reduce((s, n) => s + (n.amount || 0), 0);
    const otherTotal = Math.max(0, (totalSpending || 0) - namedSum);
    if (otherTotal > 0 && totalSpending > 0 && (otherTotal / totalSpending) * 100 >= 0.1) {
      named.push({
        id: "__other__",
        label: "Other",
        amount: otherTotal,
        color: "var(--color-muted)",
        rank: named.length,
        isOther: true,
      });
    }
    return named;
  }, [viewMode, categories, priorCategories, totalSpending]);

  // Bar widths:
  //  - thisMonth: scaled to the largest row's amount (easier to compare ranks)
  //  - changes:   scaled to the largest abs(delta) so the bar visually
  //               reinforces the movement size, not the raw total
  const maxBarValue = useMemo(() => {
    if (viewMode === "changes") {
      return rows.reduce((m, r) => Math.max(m, Math.abs(r.delta || 0)), 0);
    }
    return rows.reduce((m, r) => Math.max(m, r.amount || 0), 0);
  }, [rows, viewMode]);

  const onRowClick = (row) => {
    if (!row || row.isOther || !row.id) return;
    router.push(`/transactions?categoryIds=${row.id}&dateRange=30days`);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col animate-pulse">
        <div className="flex items-center justify-between mb-5">
          <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
          <div className="h-7 w-40 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-9 w-32 bg-[var(--color-border)] rounded mb-2" />
        <div className="h-3 w-20 bg-[var(--color-border)] rounded mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-[var(--color-border)] rounded" />
                <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
              </div>
              <div className="h-2 w-full bg-[var(--color-border)] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="card-header mb-5">Top Spending</div>
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-muted)]">
          Failed to load data
        </div>
      </div>
    );
  }

  const isChanges = viewMode === "changes";

  if (rows.length === 0 || (!isChanges && totalSpending === 0)) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="card-header">Top Spending</div>
          <SegmentedTabs
            options={viewOptions}
            value={viewMode}
            onChange={setViewMode}
            size="sm"
          />
        </div>
        <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-muted)] mb-1.5">
          <CurrencyAmount amount={0} />
        </div>
        <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-5">
          {isChanges ? `vs ${dateRanges.priorMonthLabel}` : "This Month"}
        </div>
        <div className="text-xs text-[var(--color-muted)]">
          {isChanges ? "No changes to show." : "No spending yet."}
        </div>
      </div>
    );
  }

  const hovered = hoverIndex !== null ? rows[hoverIndex] : null;

  // Hero number:
  //   thisMonth: total spent this month, swaps to hovered row on hover
  //   changes:   net spending delta vs prior period, swaps to hovered row's delta on hover
  let heroValue, heroLabel, heroDelta;
  if (isChanges) {
    const netDelta = totalSpending - priorTotalSpending;
    heroValue = hovered ? hovered.amount : totalSpending;
    heroDelta = hovered ? hovered.delta : netDelta;
    heroLabel = hovered
      ? hovered.label
      : `vs ${dateRanges.priorMonthLabel}`;
  } else {
    heroValue = hovered ? hovered.amount : totalSpending;
    heroLabel = hovered ? hovered.label : "This Month";
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="card-header">Top Spending</div>
        <SegmentedTabs
          options={viewOptions}
          value={viewMode}
          onChange={setViewMode}
          size="sm"
        />
      </div>

      {/* Hero number */}
      <div>
        <div className="flex items-baseline gap-3 mb-1.5">
          <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] transition-colors">
            <CurrencyAmount amount={heroValue} />
          </div>
          {isChanges && Number.isFinite(heroDelta) && Math.abs(heroDelta) > 0.5 && (
            <div
              className={`text-xs font-medium tabular-nums ${
                heroDelta > 0 ? "text-red-500" : "text-emerald-500"
              }`}
            >
              {heroDelta > 0 ? "▲" : "▼"}{" "}
              <CurrencyAmount amount={Math.abs(heroDelta)} />
            </div>
          )}
        </div>
        <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-6">
          {heroLabel}
        </div>
      </div>

      {/* Per-row bars */}
      <div
        className="space-y-3.5"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {rows.map((row, i) => {
          const barBasis = isChanges ? Math.abs(row.delta || 0) : row.amount || 0;
          const widthPct = maxBarValue > 0 ? (barBasis / maxBarValue) * 100 : 0;
          const isHovered = hoverIndex === i;
          const isDimmed = hoverIndex !== null && !isHovered;
          // In "changes" mode: ▲ = more spending (red), ▼ = less (emerald).
          const deltaPositive = isChanges && (row.delta || 0) > 0;
          const deltaNegative = isChanges && (row.delta || 0) < 0;
          const deltaColor = deltaPositive
            ? "text-red-500"
            : deltaNegative
              ? "text-emerald-500"
              : "text-[var(--color-muted)]";
          const barColor = isChanges
            ? (deltaPositive ? "#ef4444" : deltaNegative ? "#10b981" : "var(--color-muted)")
            : row.color;

          return (
            <div
              key={row.id}
              className={`group ${row.isOther ? "" : "cursor-pointer"}`}
              style={{
                opacity: isDimmed ? 0.4 : 1,
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={() => setHoverIndex(i)}
              onClick={() => onRowClick(row)}
            >
              <div className="flex items-baseline justify-between mb-1.5 gap-3">
                <span
                  className={`text-xs truncate ${
                    isHovered
                      ? "text-[var(--color-fg)] font-medium"
                      : "text-[var(--color-fg)]"
                  }`}
                  style={{ transition: "font-weight 0.15s ease" }}
                >
                  {row.label}
                </span>
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  {isChanges && Math.abs(row.delta || 0) >= 0.5 && (
                    <span className={`text-[10px] tabular-nums ${deltaColor}`}>
                      {deltaPositive ? "▲" : "▼"}{" "}
                      <CurrencyAmount amount={Math.abs(row.delta)} />
                    </span>
                  )}
                  <span className="text-xs font-medium text-[var(--color-fg)] tabular-nums">
                    <CurrencyAmount amount={row.amount} />
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: barColor,
                    opacity: isHovered ? 1 : 0.85,
                    transition:
                      "opacity 0.15s ease, width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
