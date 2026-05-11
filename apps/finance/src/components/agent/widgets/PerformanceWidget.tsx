"use client";

import { useId, useMemo } from "react";
import { LineChart } from "@zervo/ui";
import { formatCurrency } from "../../../lib/formatCurrency";
import { WidgetError, WidgetFrame, WidgetLabel } from "./primitives";

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
  // Hooks run unconditionally before any early returns so the rules-of-
  // hooks pass with the error branches below.
  const chartData = useMemo(() => {
    // Same shape InvestmentsChart hands to LineChart: dateString + value.
    // Recharts won't render a single point as a line, so when only one
    // historical point exists we synthesize a flat baseline 30 days back
    // — matches the InvestmentsChart fallback.
    const rawSeries = data.series ?? [];
    const points = rawSeries.map((p) => ({
      dateString: p.date,
      date: new Date(p.date),
      value: p.value,
    }));
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

  // useId keeps the recharts gradient defs unique even if multiple
  // PerformanceWidgets render on the same page (different conversation
  // turns, history). Without this they'd collide and one widget would
  // render with another's gradient color.
  const gradientId = useId().replace(/:/g, "");

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

      {chartData.length >= 2 ? (
        <div className="mt-4">
          {/* Same LineChart the /investments page uses (and the net
              worth chart on /accounts). Same gradient, same monotone
              interpolation, same animation duration — keeps the agent
              widget visually consistent with the rest of the app. */}
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
          />
        </div>
      ) : null}

      {partialNote && (
        <div className="mt-3 text-[11px] text-[var(--color-muted)]">
          {partialNote}
        </div>
      )}
    </WidgetFrame>
  );
}
