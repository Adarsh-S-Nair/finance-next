"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";
import { SegmentedTabs } from "@zervo/ui";

const MAX_ROWS = 6;

function getRangeFor(viewMode) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (viewMode === "last30") {
    const start = new Date(today);
    start.setDate(today.getDate() - 29); // inclusive → 30 days
    return { startDate: fmt(start), endDate: fmt(today), label: "Last 30 Days" };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { startDate: fmt(start), endDate: fmt(today), label: "This Month" };
}

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("thisMonth");

  const viewOptions = [
    { label: "This Month", value: "thisMonth" },
    { label: "Last 30 Days", value: "last30" },
  ];

  const range = useMemo(() => getRangeFor(viewMode), [viewMode]);

  useEffect(() => {
    // Prefetched data covers the default (This Month) view only.
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
        const url = `/api/transactions/spending-by-category?startDate=${range.startDate}&endDate=${range.endDate}`;
        const res = await authFetch(url);
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        setCategories((data.categories || []).slice(0, 20));
        setTotalSpending(data.totalSpending || 0);
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
    range.startDate,
    range.endDate,
  ]);

  // Top N by spend, with a collapsed "Other" tail for everything else so the
  // percentages in the list actually sum to total spending.
  const rows = useMemo(() => {
    if (!categories.length) return [];
    const namedCount = MAX_ROWS - 1;
    const named = categories.slice(0, namedCount).map((cat) => ({
      id: cat.id,
      label: cat.label,
      amount: cat.total_spent,
      color: cat.hex_color || "var(--color-fg)",
    }));
    const namedSum = named.reduce((s, n) => s + (n.amount || 0), 0);
    const otherTotal = Math.max(0, (totalSpending || 0) - namedSum);
    if (otherTotal > 0 && totalSpending > 0 && (otherTotal / totalSpending) * 100 >= 0.1) {
      named.push({
        id: "__other__",
        label: "Other",
        amount: otherTotal,
        color: "var(--color-muted)",
        isOther: true,
      });
    }
    return named;
  }, [categories, totalSpending]);

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
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--color-border)]" />
              <div className="h-3 w-24 bg-[var(--color-border)] rounded" />
              <div className="flex-1" />
              <div className="h-3 w-14 bg-[var(--color-border)] rounded" />
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

  const isEmpty = rows.length === 0 || totalSpending === 0;
  const maxAmount = rows.reduce((m, r) => Math.max(m, r.amount || 0), 0);

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

      <div>
        <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] leading-none">
          <CurrencyAmount amount={totalSpending} />
        </div>
        <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mt-2 mb-6">
          {range.label}
        </div>
      </div>

      {isEmpty ? (
        <div className="text-xs text-[var(--color-muted)]">
          No spending yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const widthPct = maxAmount > 0 ? ((row.amount || 0) / maxAmount) * 100 : 0;

            return (
              <div
                key={row.id}
                className={`group ${row.isOther ? "" : "cursor-pointer"}`}
                onClick={() => onRowClick(row)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="text-xs text-[var(--color-fg)] truncate flex-1 group-hover:font-medium transition-all">
                    {row.label}
                  </span>
                  <span className="text-xs font-medium text-[var(--color-fg)] tabular-nums flex-shrink-0">
                    <CurrencyAmount amount={row.amount} />
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden ml-4">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: row.color,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
