"use client";

import { useMemo, useState } from "react";
import InteractiveDonut, { type DonutSegment } from "../../InteractiveDonut";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame } from "./primitives";

type Category = {
  label: string;
  total: number;
  color: string;
  percent: number;
};

export type SpendingBreakdownData = {
  period: "this_month" | "last_30_days" | "last_90_days" | "last_month";
  start: string;
  end: string;
  categories: Category[];
  total_spending: number;
  error?: string;
};

// Roll anything below this share into a single "Other" slice so the donut
// reads cleanly instead of fraying into unreadable slivers — same threshold
// the dashboard's TopCategoriesCard uses.
const MIN_SEGMENT_PCT = 3;
const OTHER_COLOR = "var(--color-muted)";

const PERIOD_LABELS: Record<SpendingBreakdownData["period"], string> = {
  this_month: "This Month",
  last_month: "Last Month",
  last_30_days: "Last 30 Days",
  last_90_days: "Last 90 Days",
};

export default function SpendingBreakdownWidget({ data }: { data: SpendingBreakdownData }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build the donut segments: keep categories that are at least
  // MIN_SEGMENT_PCT of spending as their own slice, fold the rest into
  // "Other". The legend below renders this exact set so slices and rows
  // always line up.
  const segments = useMemo<DonutSegment[]>(() => {
    const cats = data.categories ?? [];
    if (!cats.length || !data.total_spending) return [];

    const named: DonutSegment[] = cats
      .filter((c) => c.percent >= MIN_SEGMENT_PCT)
      .map((c) => ({ id: c.label, label: c.label, value: c.total, color: c.color }));

    const namedSum = named.reduce((s, n) => s + n.value, 0);
    const otherTotal = Math.max(0, data.total_spending - namedSum);
    if (otherTotal > 0 && (otherTotal / data.total_spending) * 100 >= 0.1) {
      named.push({
        id: "__other__",
        label: "Other",
        value: Math.round(otherTotal * 100) / 100,
        color: OTHER_COLOR,
        isOther: true,
      });
    }
    return named;
  }, [data.categories, data.total_spending]);

  if (data.error) return <WidgetError message={data.error} />;

  if (segments.length === 0) {
    return (
      <WidgetFrame>
        <div className="text-xs text-[var(--color-muted)]">No spending in this period.</div>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame>
      <div className="flex justify-center">
        <InteractiveDonut
          segments={segments}
          total={data.total_spending}
          centerLabel={PERIOD_LABELS[data.period] ?? "Spending"}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          pctSuffix="of spending"
        />
      </div>

      {/* Legend doubles as the breakdown list — hovering a row cross-
          highlights the matching donut slice (and vice versa). */}
      <div className="mt-5 space-y-2.5">
        {segments.map((seg, i) => {
          const percent =
            data.total_spending > 0
              ? Math.round((seg.value / data.total_spending) * 100)
              : 0;
          const dimmed = hoveredId !== null && hoveredId !== seg.id;
          return (
            <MagicItem key={seg.id} index={i}>
              <div
                className="flex items-center justify-between gap-3 text-xs transition-opacity"
                style={{ opacity: dimmed ? 0.4 : 1 }}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                    aria-hidden
                  />
                  <span className="text-[var(--color-fg)] truncate">{seg.label}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[var(--color-muted)] tabular-nums">{percent}%</span>
                  <span className="text-[var(--color-fg)] tabular-nums w-16 text-right">
                    {formatCurrency(seg.value)}
                  </span>
                </div>
              </div>
            </MagicItem>
          );
        })}
      </div>
    </WidgetFrame>
  );
}
