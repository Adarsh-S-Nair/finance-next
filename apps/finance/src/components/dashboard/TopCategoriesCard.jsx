"use client";

import React, { useState, useEffect, useMemo } from "react";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";
import { SegmentedTabs } from "@zervo/ui";

const MAX_ROWS = 5;
const DONUT_SIZE = 220;
const DONUT_STROKE = 16;
// Butt caps draw flat ends, so the gap is exactly what we specify — no
// need to oversize it to survive cap overhang.
const SEGMENT_GAP_PX = 10;
// Anything under this threshold rolls into Other so every visible slice
// has enough arc to read as a real segment (not a sliver).
const MIN_SEGMENT_PCT = 3;

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
    <div className="animate-pulse flex flex-1 items-center justify-center">
      <div
        className="rounded-full bg-[var(--color-border)]"
        style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
      />
    </div>
  );
}

// Segmented donut with a small arc gap between slices. strokeLinecap="round"
// gives each slice pill-shaped ends so the gap reads as a clean separation
// rather than a sharp cut.
function InteractiveDonut({ segments, total, rangeLabel, hoveredId, onHover, onClick }) {
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  // When there's only one segment, a gap would create a visible notch in
  // what should look like a continuous ring — skip it.
  const effectiveGap = segments.length > 1 ? SEGMENT_GAP_PX : 0;

  let cumulative = 0;
  const rendered = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const arc = pct * circumference;
    const dash = Math.max(0.001, arc - effectiveGap);
    const dashArray = `${dash} ${circumference}`;
    const dashOffset = -cumulative;
    cumulative += arc;
    return { ...seg, dashArray, dashOffset, pct };
  });

  const hovered = hoveredId
    ? rendered.find((r) => r.id === hoveredId)
    : null;

  const centerAmount = hovered ? hovered.value : total;
  const centerLabel = hovered ? hovered.label : rangeLabel;
  const centerPct = hovered ? Math.round(hovered.pct * 100) : null;

  return (
    <div
      className="relative"
      style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
      onMouseLeave={() => onHover(null)}
    >
      <svg
        width={DONUT_SIZE}
        height={DONUT_SIZE}
        className="-rotate-90"
        style={{ overflow: "visible" }}
      >
        {rendered.map((seg) => {
          const isHovered = hoveredId === seg.id;
          const dimmed = hoveredId && !isHovered;
          return (
            <circle
              key={seg.id}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isHovered ? DONUT_STROKE + 4 : DONUT_STROKE}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              style={{
                opacity: dimmed ? 0.4 : 1,
                cursor: seg.isOther ? "default" : "pointer",
                transition:
                  "opacity 0.15s ease, stroke-width 0.15s ease",
              }}
              onMouseEnter={() => onHover(seg.id)}
              onClick={() => !seg.isOther && onClick?.(seg)}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
        <div className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider truncate max-w-full">
          {centerLabel}
        </div>
        <div className="text-2xl font-medium text-[var(--color-fg)] tabular-nums leading-tight mt-1">
          <CurrencyAmount amount={centerAmount} />
        </div>
        {centerPct !== null && (
          <div className="text-[11px] tabular-nums text-[var(--color-muted)] mt-0.5">
            {centerPct}% of spending
          </div>
        )}
      </div>
    </div>
  );
}

export default function TopCategoriesCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("thisMonth");
  const [hoveredId, setHoveredId] = useState(null);

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

  const segments = useMemo(() => {
    if (!categories.length || !totalSpending) return [];

    // Keep categories that are both in the top N AND at least MIN_SEGMENT_PCT
    // of total spending; everything else rolls into "Other". That avoids
    // lollipop-stub slices and ensures the donut always reads cleanly.
    const top = categories.slice(0, MAX_ROWS);
    const named = top
      .filter((cat) => (cat.total_spent / totalSpending) * 100 >= MIN_SEGMENT_PCT)
      .map((cat) => ({
        id: cat.id,
        label: cat.label,
        value: cat.total_spent,
        color: cat.hex_color || "var(--color-muted)",
      }));

    const namedSum = named.reduce((s, n) => s + (n.value || 0), 0);
    const otherTotal = Math.max(0, totalSpending - namedSum);
    if (otherTotal > 0 && (otherTotal / totalSpending) * 100 >= 0.1) {
      named.push({
        id: "__other__",
        label: "Other",
        value: otherTotal,
        color: "var(--color-muted)",
        isOther: true,
      });
    }
    return named;
  }, [categories, totalSpending]);

  const onSegmentClick = (seg) => {
    if (!seg || seg.isOther || !seg.id) return;
    router.push(`/transactions?categoryIds=${seg.id}&dateRange=30days`);
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
            rangeLabel={range.label}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onClick={onSegmentClick}
          />
        </div>
      )}
    </div>
  );
}
