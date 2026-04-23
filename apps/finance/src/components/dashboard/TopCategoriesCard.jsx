"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";
import { SegmentedTabs, CustomDonut } from "@zervo/ui";

const MAX_ROWS = 5;

function getRangeFor(viewMode) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (viewMode === "last30") {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { startDate: fmt(start), endDate: fmt(today), label: "Last 30 Days" };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { startDate: fmt(start), endDate: fmt(today), label: "This Month" };
}

const viewOptions = [
  { label: "This Month", value: "thisMonth" },
  { label: "Last 30 Days", value: "last30" },
];

function Header({ viewMode, setViewMode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="card-header">Top Spending</div>
      <SegmentedTabs
        options={viewOptions}
        value={viewMode}
        onChange={setViewMode}
        size="sm"
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse flex flex-col items-center">
      <div className="w-[140px] h-[140px] rounded-full bg-[var(--color-border)] mb-6" />
      <div className="w-full space-y-2.5">
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

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  // `loading` is only surfaced on the initial mount. Subsequent tab switches
  // keep the prior chart/legend visible so the skeleton doesn't flash in
  // between fetches — that flicker made the header feel like it reloaded.
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("thisMonth");

  const range = useMemo(() => getRangeFor(viewMode), [viewMode]);

  useEffect(() => {
    if (externalData && viewMode === "thisMonth") {
      setCategories((externalData.categories || []).slice(0, 20));
      setTotalSpending(externalData.totalSpending || 0);
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        if (!hasLoaded) setLoading(true);
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
        setHasLoaded(true);
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
    hasLoaded,
  ]);

  // Top N + collapsed "Other" tail so percentages actually sum to the total.
  const rows = useMemo(() => {
    if (!categories.length) return [];
    const named = categories.slice(0, MAX_ROWS).map((cat) => ({
      id: cat.id,
      label: cat.label,
      amount: cat.total_spent,
      color: cat.hex_color || "var(--color-muted)",
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

  const donutData = useMemo(
    () =>
      rows.map((r) => ({
        label: r.label,
        value: r.amount,
        color: r.color,
      })),
    [rows],
  );

  const onRowClick = (row) => {
    if (!row || row.isOther || !row.id) return;
    router.push(`/transactions?categoryIds=${row.id}&dateRange=30days`);
  };

  const isEmpty = rows.length === 0 || totalSpending === 0;
  const showSkeleton = loading && !hasLoaded;

  return (
    <div className="h-full flex flex-col">
      <Header viewMode={viewMode} setViewMode={setViewMode} />

      {showSkeleton ? (
        <Skeleton />
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-muted)]">
          Failed to load data
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="text-3xl font-medium tracking-tight text-[var(--color-muted)]">
            <CurrencyAmount amount={0} />
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            No spending in {range.label.toLowerCase()}
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center"
          style={{
            opacity: loading ? 0.55 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <div className="relative mb-5">
            <CustomDonut
              data={donutData}
              size={140}
              strokeWidth={16}
              showTotal={false}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xl font-medium text-[var(--color-fg)] tabular-nums leading-none">
                <CurrencyAmount amount={totalSpending} />
              </div>
              <div className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mt-1.5">
                {range.label}
              </div>
            </div>
          </div>

          <div className="w-full space-y-2">
            {rows.map((row) => {
              const pct =
                totalSpending > 0
                  ? Math.round((row.amount / totalSpending) * 100)
                  : 0;
              return (
                <div
                  key={row.id}
                  className={`flex items-center gap-2 py-0.5 ${
                    row.isOther ? "" : "cursor-pointer hover:bg-[var(--color-surface-alt)] -mx-2 px-2 rounded-md"
                  } transition-colors`}
                  onClick={() => onRowClick(row)}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="text-xs text-[var(--color-fg)] truncate flex-1">
                    {row.label}
                  </span>
                  <span className="text-[10px] tabular-nums text-[var(--color-muted)] flex-shrink-0 w-8 text-right">
                    {pct}%
                  </span>
                  <span className="text-xs font-medium text-[var(--color-fg)] tabular-nums flex-shrink-0">
                    <CurrencyAmount amount={row.amount} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
