"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import SegmentedTabs from "../ui/SegmentedTabs";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";

const MAX_ROWS = 6;

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
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

  // Top (MAX_ROWS - 1) named, rest collapsed into "Other".
  const rows = useMemo(() => {
    if (!categories.length) return [];
    const namedCount = MAX_ROWS - 1;
    const named = categories.slice(0, namedCount).map((cat, i) => ({
      id: cat.id,
      label: cat.label,
      amount: cat.total_spent,
      color: cat.hex_color || 'var(--color-fg)',
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
          color: 'var(--color-muted)',
          rank: named.length,
          isOther: true,
        });
      }
    }
    return named;
  }, [categories]);

  // Each row's bar is sized relative to the largest row, not to the total —
  // makes the visual easier to read when the top category dominates.
  const maxAmount = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.amount || 0), 0),
    [rows]
  );

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

  if (rows.length === 0 || totalSpending === 0) {
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
        <div className="text-xs text-[var(--color-muted)]">No spending yet.</div>
      </div>
    );
  }

  const hovered = hoverIndex !== null ? rows[hoverIndex] : null;
  const heroValue = hovered ? hovered.amount : totalSpending;
  const heroLabel = hovered
    ? hovered.label
    : periodOptions.find((p) => p.value === selectedPeriod)?.label;

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
        <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-6">
          {heroLabel}
        </div>
      </div>

      {/* Per-row horizontal bars */}
      <div
        className="space-y-3.5"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {rows.map((row, i) => {
          const widthPct = maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0;
          const sharePct = totalSpending > 0 ? (row.amount / totalSpending) * 100 : 0;
          const isHovered = hoverIndex === i;
          const isDimmed = hoverIndex !== null && !isHovered;
          return (
            <div
              key={row.id}
              className={`group ${row.isOther ? '' : 'cursor-pointer'}`}
              style={{
                opacity: isDimmed ? 0.4 : 1,
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={() => setHoverIndex(i)}
              onClick={() => onRowClick(row)}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span
                  className={`text-xs truncate ${
                    isHovered
                      ? 'text-[var(--color-fg)] font-medium'
                      : 'text-[var(--color-fg)]'
                  }`}
                  style={{ transition: 'font-weight 0.15s ease' }}
                >
                  {row.label}
                </span>
                <div className="flex items-baseline gap-2 flex-shrink-0 ml-3">
                  <span className="text-xs font-medium text-[var(--color-fg)] tabular-nums">
                    <CurrencyAmount amount={row.amount} />
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)] tabular-nums w-7 text-right">
                    {sharePct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: row.color,
                    opacity: isHovered ? 1 : 0.85,
                    transition: 'opacity 0.15s ease, width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
