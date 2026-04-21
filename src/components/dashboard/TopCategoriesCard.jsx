"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import SegmentedTabs from "../ui/SegmentedTabs";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";

const MAX_LEGEND_ROWS = 8;

// Solid grayscale shade for a segment by rank (0 = top spender, darkest).
// Gradient from --color-fg towards --color-muted so every step stays visible.
function shadeFor(rank) {
  const stops = [0, 22, 38, 52, 64, 74, 82, 88];
  const idx = Math.min(rank, stops.length - 1);
  return `color-mix(in srgb, var(--color-fg), var(--color-muted) ${stops[idx]}%)`;
}

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');

  const periodOptions = [
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last 30 Days', value: 'last30' },
  ];

  useEffect(() => {
    if (externalData && selectedPeriod === 'thisMonth') {
      setCategories((externalData.categories || []).slice(0, 10));
      setTotalSpending(externalData.totalSpending || 0);
      setLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user?.id) { setLoading(false); return; }
    async function fetchData() {
      try {
        setLoading(true);
        const now = new Date();
        let apiUrl;
        if (selectedPeriod === 'thisMonth') {
          const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          apiUrl = `/api/transactions/spending-by-category?startDate=${startDate}&endDate=${endDate}`;
        } else {
          apiUrl = `/api/transactions/spending-by-category?days=30`;
        }
        const res = await authFetch(apiUrl);
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        setCategories(data.categories.slice(0, 10));
        setTotalSpending(data.totalSpending || 0);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [authLoading, user?.id, selectedPeriod, externalData]);

  // Top (MAX_LEGEND_ROWS - 1) named categories, rest collapsed into "Other".
  const segments = useMemo(() => {
    if (!categories.length) return [];
    const namedCount = MAX_LEGEND_ROWS - 1;
    const named = categories.slice(0, namedCount).map((cat, i) => ({
      id: cat.id,
      label: cat.label,
      amount: cat.total_spent,
      rank: i,
    }));
    const rest = categories.slice(namedCount);
    if (rest.length > 0) {
      const otherTotal = rest.reduce((s, c) => s + (c.total_spent || 0), 0);
      if (otherTotal > 0) {
        named.push({
          id: '__other__',
          label: 'Other',
          amount: otherTotal,
          rank: named.length,
          isOther: true,
        });
      }
    }
    return named;
  }, [categories]);

  const onRowClick = (seg) => {
    if (!seg || seg.isOther || !seg.id) return;
    router.push(`/transactions?categoryIds=${seg.id}&dateRange=30days`);
  };

  const hoveredSeg = activeIndex !== null ? segments[activeIndex] : null;
  const heroValue = hoveredSeg ? hoveredSeg.amount : totalSpending;
  const heroLabel = hoveredSeg
    ? hoveredSeg.label
    : periodOptions.find((p) => p.value === selectedPeriod)?.label;

  if (loading) {
    return (
      <div className="h-full flex flex-col animate-pulse">
        <div className="flex items-center justify-between mb-5">
          <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
          <div className="h-7 w-40 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-9 w-32 bg-[var(--color-border)] rounded mb-2" />
        <div className="h-3 w-20 bg-[var(--color-border)] rounded mb-5" />
        <div className="h-3 w-full bg-[var(--color-border)] rounded-full mb-5" />
        <div className="flex-1 flex flex-col justify-between">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)]" />
                <div className="h-3 w-20 bg-[var(--color-border)] rounded" />
              </div>
              <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
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

  if (segments.length === 0 || totalSpending === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="card-header">Top Spending</div>
          <SegmentedTabs
            options={periodOptions}
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            size="sm"
          />
        </div>
        <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-muted)] mb-1.5">
          <CurrencyAmount amount={0} />
        </div>
        <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-5">
          {periodOptions.find((p) => p.value === selectedPeriod)?.label}
        </div>
        <div className="h-3 w-full rounded-full bg-[var(--color-surface-alt)] mb-5" />
        <div className="text-xs text-[var(--color-muted)]">No spending yet.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="card-header">Top Spending</div>
        <SegmentedTabs
          options={periodOptions}
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          size="sm"
        />
      </div>

      {/* Hero number */}
      <div>
        <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] mb-1.5 transition-colors">
          <CurrencyAmount amount={heroValue} />
        </div>
        <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-5">
          {heroLabel}
        </div>
      </div>

      {/* Stacked bar */}
      <div
        className="h-3 w-full flex rounded-full overflow-hidden bg-[var(--color-surface-alt)] mb-5"
        onMouseLeave={() => setActiveIndex(null)}
      >
        {segments.map((seg, i) => {
          const pct = totalSpending > 0 ? (seg.amount / totalSpending) * 100 : 0;
          if (pct === 0) return null;
          const isActive = activeIndex === i;
          const isDimmed = activeIndex !== null && !isActive;
          return (
            <div
              key={seg.id}
              className={`h-full ${seg.isOther ? '' : 'cursor-pointer'}`}
              style={{
                width: `${pct}%`,
                backgroundColor: shadeFor(seg.rank),
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onRowClick(seg)}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2.5">
        {segments.map((seg, i) => {
          const pct = totalSpending > 0 ? (seg.amount / totalSpending) * 100 : 0;
          const isActive = activeIndex === i;
          const isDimmed = activeIndex !== null && !isActive;
          return (
            <div
              key={seg.id}
              className={`flex items-center justify-between ${seg.isOther ? '' : 'cursor-pointer'}`}
              style={{
                opacity: isDimmed ? 0.4 : 1,
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => onRowClick(seg)}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: shadeFor(seg.rank) }}
                />
                <span
                  className={`text-xs truncate ${
                    isActive ? 'text-[var(--color-fg)] font-medium' : 'text-[var(--color-muted)]'
                  }`}
                  style={{ transition: 'color 0.2s ease' }}
                >
                  {seg.label}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <span className="text-xs font-semibold text-[var(--color-fg)] tabular-nums">
                  <CurrencyAmount amount={seg.amount} />
                </span>
                <span className="text-[10px] text-[var(--color-muted)] tabular-nums w-7 text-right">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
