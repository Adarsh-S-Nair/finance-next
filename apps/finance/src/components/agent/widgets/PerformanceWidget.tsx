"use client";

import { useId, useMemo, useState } from "react";
import { LineChart } from "@zervo/ui";
import { formatCurrency } from "../../../lib/formatCurrency";
import { WidgetError, WidgetFrame } from "./primitives";

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

interface ChartPoint {
  dateString: string;
  date: Date;
  value: number;
}

export default function PerformanceWidget({ data }: { data: PerformanceData }) {
  // All hooks run unconditionally before the early-return branches —
  // rules-of-hooks.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = useMemo<ChartPoint[]>(() => {
    const raw = data.series ?? [];
    const points: ChartPoint[] = raw.map((p) => ({
      dateString: p.date,
      date: new Date(p.date),
      value: p.value,
    }));
    // Recharts needs ≥ 2 points to draw a line. If we only have one,
    // synthesize a flat baseline 30 days back — matches InvestmentsChart.
    if (points.length === 1) {
      const earlier = new Date(points[0].date);
      earlier.setDate(earlier.getDate() - 30);
      return [
        {
          dateString: earlier.toISOString().slice(0, 10),
          date: earlier,
          value: points[0].value,
        },
        points[0],
      ];
    }
    return points;
  }, [data.series]);

  // Stable gradient id so multiple widget instances on the page (history
  // + new turn) don't collide on recharts shared defs.
  const gradientId = useId().replace(/:/g, "");

  if (data.error) {
    // Special-case: tool returned an error string but still gave us
    // end_value. Show the current portfolio with the explanation, not
    // just a red error pill.
    if (data.end_value !== undefined) {
      return (
        <WidgetFrame>
          <Header
            label={data.period_label ?? "Performance"}
            currentValue={data.end_value}
            startValue={data.end_value}
            displayDate={null}
          />
          <div className="text-[11px] text-[var(--color-muted)] mt-2">
            {data.error}
          </div>
        </WidgetFrame>
      );
    }
    return <WidgetError message={data.error} />;
  }

  const hasChart = chartData.length >= 2;
  // Hover resolves to whichever point recharts says is active; otherwise
  // fall back to the most recent point so the headline shows "now".
  const displayPoint =
    activeIndex !== null && chartData[activeIndex]
      ? chartData[activeIndex]
      : chartData[chartData.length - 1];

  const currentDisplayValue = displayPoint?.value ?? data.end_value ?? 0;
  // Delta computed from the FIRST visible point in the chart, so as the
  // user hovers earlier in the range the delta updates relative to the
  // chart's anchor. Matches InvestmentsChart behavior.
  const startValueForDelta = chartData[0]?.value ?? data.start_value ?? 0;

  const missing = data.accounts_missing_history ?? [];
  const withHistory = data.accounts_with_full_history ?? [];
  const partialNote =
    missing.length > 0 && withHistory.length > 0
      ? `Excludes ${missing.length} account${missing.length === 1 ? "" : "s"} with no history for this period.`
      : null;

  // Line color is keyed off the OVERALL trend (first to last), not the
  // hovered delta, so the line itself doesn't flip color mid-hover.
  const overallUp = (chartData[chartData.length - 1]?.value ?? 0) >= (chartData[0]?.value ?? 0);
  const lineColor = overallUp
    ? "var(--color-success)"
    : "var(--color-danger)";

  return (
    <WidgetFrame>
      <div onMouseLeave={() => setActiveIndex(null)}>
        <Header
          label={data.period_label ?? data.period ?? "Performance"}
          currentValue={currentDisplayValue}
          startValue={startValueForDelta}
          displayDate={displayPoint?.dateString ?? null}
          hasDelta={hasChart}
        />

        {hasChart ? (
          <div className="mt-4">
            <LineChart
              data={chartData}
              dataKey="value"
              width="100%"
              height={140}
              margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
              strokeColor={lineColor}
              strokeWidth={2}
              showArea={true}
              areaOpacity={0.15}
              showDots={false}
              showTooltip={false}
              gradientId={`agentPerformanceGradient-${gradientId}`}
              curveType="monotone"
              animationDuration={800}
              xAxisDataKey="dateString"
              yAxisDomain={["dataMin", "dataMax"]}
              onMouseMove={(_d, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          </div>
        ) : null}

        {partialNote && (
          <div className="mt-3 text-[11px] text-[var(--color-muted)]">
            {partialNote}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}

/**
 * Header strip: uppercase period label + current/hovered value on the
 * left, hover date on the right. Mirrors the InvestmentsChart layout
 * exactly so the agent widget reads as the same surface as the
 * /investments page.
 */
function Header({
  label,
  currentValue,
  startValue,
  displayDate,
  hasDelta = true,
}: {
  label: string;
  currentValue: number;
  startValue: number;
  displayDate: string | null;
  hasDelta?: boolean;
}) {
  const delta = currentValue - startValue;
  const deltaPct =
    startValue !== 0 ? (delta / Math.abs(startValue)) * 100 : 0;
  const positive = delta > 0;
  const negative = delta < 0;
  const deltaColor = positive
    ? "text-emerald-500"
    : negative
      ? "text-rose-500"
      : "text-[var(--color-muted)]";
  const sign = positive ? "+" : "";

  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          {label}
        </div>
        <div className="mt-1 text-3xl font-medium tabular-nums text-[var(--color-fg)]">
          {formatCurrency(currentValue, true)}
        </div>
        {hasDelta && (
          <div className={`mt-1 text-xs font-medium tabular-nums ${deltaColor}`}>
            {sign}
            {formatCurrency(delta, true)} ({sign}
            {deltaPct.toFixed(2)}%)
          </div>
        )}
      </div>
      <div className="text-right text-xs text-[var(--color-muted)]">
        {displayDate
          ? new Date(displayDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : ""}
      </div>
    </div>
  );
}
