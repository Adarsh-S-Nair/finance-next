"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";
import { WidgetError, WidgetFrame, WidgetLabel, useAnimate } from "./primitives";

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
  const barColor = positive
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

      {/* Start → end values, plus an animated bar that visually
          represents the magnitude of the change relative to the start
          value. Cap the visual range at ±50% so a wild outlier doesn't
          stretch the bar to absurd lengths. */}
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

      <ChangeBar
        pct={changePct}
        color={barColor}
        positive={positive}
      />

      {partialNote && (
        <div className="mt-3 text-[11px] text-[var(--color-muted)]">
          {partialNote}
        </div>
      )}
    </WidgetFrame>
  );
}

function ChangeBar({
  pct,
  color,
  positive,
}: {
  pct: number;
  color: string;
  positive: boolean;
}) {
  const animate = useAnimate();
  // Cap visual at 50% so a 200% pump doesn't blow the bar off-screen.
  // The number above already conveys magnitude; the bar is just a
  // direction + relative-strength glance.
  const visual = Math.min(50, Math.abs(pct));
  const widthPct = (visual / 50) * 50; // up to half the bar
  const barStyle: React.CSSProperties = {
    width: `${widthPct}%`,
    backgroundColor: color,
  };

  return (
    <div className="mt-3 relative h-1 rounded-full bg-[var(--color-surface-alt)]/60 overflow-visible">
      {/* Center tick — anchor for "no change". */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-3 bg-[var(--color-border)]" />
      {/* Filled segment, anchored to center, growing left or right. */}
      {animate ? (
        <motion.div
          className="absolute top-0 h-full rounded-full"
          style={{
            ...barStyle,
            left: positive ? "50%" : undefined,
            right: positive ? undefined : "50%",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : (
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            ...barStyle,
            left: positive ? "50%" : undefined,
            right: positive ? undefined : "50%",
          }}
        />
      )}
    </div>
  );
}
