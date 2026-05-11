"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";
import { WidgetError, WidgetFrame, WidgetLabel, useAnimate } from "./primitives";

type SeriesPoint = { date: string; value: number };

export type PerformanceData = {
  period?: "last_30_days" | "last_90_days" | "ytd" | "last_year";
  period_label?: string;
  start_value?: number;
  end_value?: number;
  change?: number;
  change_pct?: number;
  accounts_with_full_history?: string[];
  accounts_missing_history?: string[];
  total_portfolio_current_value?: number;
  series?: SeriesPoint[];
  error?: string;
};

export default function PerformanceWidget({ data }: { data: PerformanceData }) {
  if (data.error) {
    // Special-case: when start data is missing entirely the tool returns
    // an error string AND end_value. Show the end value alongside the
    // explanation rather than just a red error pill.
    if (data.end_value !== undefined) {
      return (
        <WidgetFrame>
          <WidgetLabel left={data.period_label ?? "Performance"} />
          <div className="text-2xl text-[var(--color-fg)] tabular-nums">
            {formatCurrency(data.end_value, true)}
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-1">
            {data.error}
          </div>
        </WidgetFrame>
      );
    }
    return <WidgetError message={data.error} />;
  }

  const startValue = data.start_value ?? 0;
  const endValue = data.end_value ?? 0;
  const change = data.change ?? 0;
  const changePct = data.change_pct ?? 0;
  const positive = change >= 0;
  const sign = positive ? "+" : "";
  const color = positive
    ? "text-[var(--color-success)]"
    : "text-[var(--color-danger)]";
  const lineColor = positive
    ? "var(--color-success)"
    : "var(--color-danger)";

  const missing = data.accounts_missing_history ?? [];
  const withHistory = data.accounts_with_full_history ?? [];
  const partialNote =
    missing.length > 0 && withHistory.length > 0
      ? `Excludes ${missing.length} account${missing.length === 1 ? "" : "s"} with no history for this period.`
      : null;

  const series = data.series ?? [];

  return (
    <WidgetFrame>
      <WidgetLabel
        left={data.period_label ?? data.period ?? "Performance"}
        right={
          <span className={`tabular-nums ${color}`}>
            {sign}
            {changePct.toFixed(2)}%
          </span>
        }
      />

      {/* Big number — the headline change in dollars. */}
      <div className={`text-3xl tabular-nums ${color}`}>
        {sign}
        {formatCurrency(change, true)}
      </div>

      {/* Start → end values for context next to the headline. */}
      <div className="mt-3 flex items-baseline gap-4 text-[11px] text-[var(--color-muted)]">
        <span>
          start{" "}
          <span className="text-[var(--color-fg)] tabular-nums">
            {formatCurrency(startValue, true)}
          </span>
        </span>
        <span>
          now{" "}
          <span className="text-[var(--color-fg)] tabular-nums">
            {formatCurrency(endValue, true)}
          </span>
        </span>
      </div>

      {series.length >= 2 ? (
        <Sparkline series={series} color={lineColor} />
      ) : null}

      {partialNote && (
        <div className="mt-3 text-[11px] text-[var(--color-muted)]">
          {partialNote}
        </div>
      )}
    </WidgetFrame>
  );
}

const SPARKLINE_HEIGHT = 56;
const SPARKLINE_PAD_Y = 4;

/**
 * Inline SVG sparkline. Uses a viewBox keyed to (series.length-1, 1) so
 * Y maps to height regardless of the parent width — the path scales to
 * fit. A subtle area fill behind the stroke makes the line read at a
 * glance even on light backgrounds.
 *
 * Animates the stroke-dashoffset on first paint so the line draws in
 * left-to-right, then unsets stroke-dasharray so it's not a fixed
 * length on re-renders.
 */
function Sparkline({
  series,
  color,
}: {
  series: SeriesPoint[];
  color: string;
}) {
  const animate = useAnimate();
  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const drawableH = SPARKLINE_HEIGHT - SPARKLINE_PAD_Y * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y =
      SPARKLINE_PAD_Y + drawableH - ((v - min) / range) * drawableH;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    `${linePath} L100,${SPARKLINE_HEIGHT} L0,${SPARKLINE_HEIGHT} Z`;

  // Unique gradient id so multiple Sparklines on the same page don't
  // collide. Includes color so positive/negative don't share an id.
  const gradId = `agent-spark-${color.replace(/[^a-z0-9]/gi, "")}-${series.length}`;

  return (
    <div className="mt-3" style={{ height: SPARKLINE_HEIGHT }}>
      <svg
        viewBox={`0 0 100 ${SPARKLINE_HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={SPARKLINE_HEIGHT}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        {animate ? (
          <motion.path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        ) : (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
