"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";
import { SegmentedTabs } from "@zervo/ui";
import InteractiveDonut from "../InteractiveDonut";

const MAX_ROWS = 5;
const DONUT_SIZE = 220;
// Anything under this threshold rolls into Other so every visible slice
// has enough arc to read as a real segment (not a sliver).
const MIN_SEGMENT_PCT = 3;

type ViewMode = "thisMonth" | "last30";

type CategoryData = {
  id: string;
  label: string;
  total_spent: number;
  hex_color?: string | null;
};

// Segment shape matches `DonutSegment` from the shared component.
type Segment = {
  id: string;
  label: string;
  value: number;
  color: string;
  isOther?: boolean;
  otherIds?: string[];
};

type ExternalData = {
  categories?: CategoryData[];
  totalSpending?: number;
};

function getRangeFor(viewMode: ViewMode) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

function Header({
  viewMode,
  setViewMode,
}: {
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="card-header">Top Spending</div>
      <SegmentedTabs
        options={viewOptions}
        value={viewMode}
        onChange={(v: string) => setViewMode(v as ViewMode)}
        size="sm"
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse flex flex-1 items-center justify-center">
      <div
        className="rounded-full bg-[var(--color-border)]"
        style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
      />
    </div>
  );
}

type Props = {
  data?: ExternalData;
};

export default function TopCategoriesCard({ data: externalData }: Props = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("thisMonth");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        setError(err instanceof Error ? err.message : String(err));
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

  const segments = useMemo<Segment[]>(() => {
    if (!categories.length || !totalSpending) return [];

    // Keep categories that are both in the top N AND at least MIN_SEGMENT_PCT
    // of total spending; everything else rolls into "Other". That avoids
    // lollipop-stub slices and ensures the donut always reads cleanly.
    const top = categories.slice(0, MAX_ROWS);
    const named: Segment[] = top
      .filter((cat) => (cat.total_spent / totalSpending) * 100 >= MIN_SEGMENT_PCT)
      .map((cat) => ({
        id: cat.id,
        label: cat.label,
        value: cat.total_spent,
        color: cat.hex_color || "var(--color-muted)",
      }));

    const namedIds = new Set(named.map((n) => n.id));
    const otherIds = categories
      .map((c) => c.id)
      .filter((id) => !namedIds.has(id));
    const namedSum = named.reduce((s, n) => s + (n.value || 0), 0);
    const otherTotal = Math.max(0, totalSpending - namedSum);
    if (otherTotal > 0 && (otherTotal / totalSpending) * 100 >= 0.1) {
      named.push({
        id: "__other__",
        label: "Other",
        value: otherTotal,
        color: "var(--color-muted)",
        isOther: true,
        otherIds,
      });
    }
    return named;
  }, [categories, totalSpending]);

  // Map the donut's view-mode toggle onto the transactions page's
  // date-range filter so clicking a slice lands you on the exact same
  // window you were looking at. thisMonth → the "this month" preset,
  // last30 → the "last 30 days" preset.
  const transactionsDateRange = viewMode === "thisMonth" ? "month" : "30days";

  const onSegmentClick = (seg: Segment) => {
    if (!seg) return;
    if (seg.isOther) {
      if (!seg.otherIds?.length) return;
      router.push(
        `/transactions?categoryIds=${seg.otherIds.join(",")}&dateRange=${transactionsDateRange}`,
      );
      return;
    }
    if (!seg.id) return;
    router.push(
      `/transactions?categoryIds=${seg.id}&dateRange=${transactionsDateRange}`,
    );
  };

  const isEmpty = segments.length === 0 || totalSpending === 0;
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
          className="flex-1 flex items-center justify-center"
          style={{
            opacity: loading ? 0.55 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <InteractiveDonut
            segments={segments}
            total={totalSpending}
            centerLabel={range.label}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onClick={onSegmentClick}
            pctSuffix="of spending"
          />
        </div>
      )}
    </div>
  );
}
