"use client";

import { useMemo, useState } from "react";
import { FiMoreHorizontal, FiTag } from "react-icons/fi";
import InteractiveDonut, { type DonutSegment } from "../../InteractiveDonut";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame } from "./primitives";

type Category = {
  label: string;
  total: number;
  color: string;
  icon_lib?: string | null;
  icon_name?: string | null;
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
// Smaller than the dashboard's 220 so the legend can sit beside it.
const DONUT_SIZE = 168;

const PERIOD_LABELS: Record<SpendingBreakdownData["period"], string> = {
  this_month: "This Month",
  last_month: "Last Month",
  last_30_days: "Last 30 Days",
  last_90_days: "Last 90 Days",
};

// Segment carries the category icon alongside the donut geometry fields so
// the legend can render the glyph without a second lookup. It's a superset
// of DonutSegment, so it passes straight to InteractiveDonut.
type LegendSegment = DonutSegment & {
  iconLib: string | null;
  iconName: string | null;
};

export default function SpendingBreakdownWidget({ data }: { data: SpendingBreakdownData }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build the donut segments: keep categories that are at least
  // MIN_SEGMENT_PCT of spending as their own slice, fold the rest into
  // "Other". The legend renders this exact set so slices and rows line up.
  const segments = useMemo<LegendSegment[]>(() => {
    const cats = data.categories ?? [];
    if (!cats.length || !data.total_spending) return [];

    const named: LegendSegment[] = cats
      .filter((c) => c.percent >= MIN_SEGMENT_PCT)
      .map((c) => ({
        id: c.label,
        label: c.label,
        value: c.total,
        color: c.color,
        iconLib: c.icon_lib ?? null,
        iconName: c.icon_name ?? null,
      }));

    const namedSum = named.reduce((s, n) => s + n.value, 0);
    const otherTotal = Math.max(0, data.total_spending - namedSum);
    if (otherTotal > 0 && (otherTotal / data.total_spending) * 100 >= 0.1) {
      named.push({
        id: "__other__",
        label: "Other",
        value: Math.round(otherTotal * 100) / 100,
        color: OTHER_COLOR,
        isOther: true,
        iconLib: "Fi",
        iconName: "FiMoreHorizontal",
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
      <div className="flex items-center gap-5 sm:gap-7">
        <div className="flex-shrink-0">
          <InteractiveDonut
            segments={segments}
            total={data.total_spending}
            centerLabel={PERIOD_LABELS[data.period] ?? "Spending"}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            size={DONUT_SIZE}
            pctSuffix="of spending"
          />
        </div>

        {/* Legend sits beside the donut and doubles as the breakdown list.
            Hovering a row cross-highlights the matching slice (and vice
            versa). Icons are monochrome — the donut carries the color. */}
        <div className="flex-1 min-w-0 space-y-2.5">
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
                    <DynamicIcon
                      iconLib={seg.iconLib}
                      iconName={seg.iconName}
                      className="h-3.5 w-3.5 text-[var(--color-muted)] flex-shrink-0"
                      fallback={seg.isOther ? FiMoreHorizontal : FiTag}
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
      </div>
    </WidgetFrame>
  );
}
