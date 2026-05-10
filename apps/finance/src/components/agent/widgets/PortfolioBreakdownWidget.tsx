"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame, WidgetLabel, useAnimate } from "./primitives";

type Segment = {
  label: string;
  amount: number;
  percentage: number;
};

export type PortfolioBreakdownData = {
  breakdown_by?: "asset_class" | "sector" | "account";
  segments?: Segment[];
  total?: number;
  error?: string;
};

// Asset-class palette mirrors apps/finance/src/app/(main)/investments/AllocationCard.jsx
// so an "asset class" breakdown surfaced through the agent uses the same
// colors the user sees on the /investments page.
const ASSET_CLASS_COLORS: Record<string, string> = {
  Stocks: "var(--color-neon-green)",
  Crypto: "var(--color-neon-purple)",
  Cash: "#059669",
};

// Generic palette for sector/account breakdowns where labels are
// arbitrary. Hash the label to a stable index so the same sector always
// gets the same color across renders.
const GENERIC_PALETTE: string[] = [
  "var(--color-neon-purple)",
  "var(--color-neon-green)",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
  "#84cc16",
  "#0ea5e9",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorFor(label: string, breakdownBy: string | undefined): string {
  if (breakdownBy === "asset_class" && ASSET_CLASS_COLORS[label]) {
    return ASSET_CLASS_COLORS[label];
  }
  return GENERIC_PALETTE[hashStr(label) % GENERIC_PALETTE.length];
}

const BREAKDOWN_LABEL: Record<string, string> = {
  asset_class: "By asset class",
  sector: "By sector",
  account: "By account",
};

export default function PortfolioBreakdownWidget({
  data,
}: {
  data: PortfolioBreakdownData;
}) {
  if (data.error) return <WidgetError message={data.error} />;

  const segments = data.segments ?? [];
  if (segments.length === 0) {
    return (
      <WidgetFrame>
        <div className="text-xs text-[var(--color-muted)]">No allocation to show.</div>
      </WidgetFrame>
    );
  }

  const breakdownBy = data.breakdown_by ?? "asset_class";
  const total = data.total ?? segments.reduce((s, x) => s + x.amount, 0);
  const enriched = segments.map((s) => ({
    ...s,
    color: colorFor(s.label, breakdownBy),
  }));

  return (
    <WidgetFrame>
      <WidgetLabel
        left={BREAKDOWN_LABEL[breakdownBy] ?? "Breakdown"}
        right={formatCurrency(total, true)}
      />

      {/* Stacked bar — same pattern as SpendingBreakdownWidget. Each
          segment animates its width in sequence. */}
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-alt)]/60 flex mb-4">
        {enriched.map((s, i) => (
          <BarSegment
            key={s.label}
            color={s.color}
            percent={s.percentage}
            index={i}
          />
        ))}
      </div>

      <div className="space-y-2.5">
        {enriched.map((s, i) => (
          <MagicItem key={s.label} index={i}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="text-[var(--color-fg)] truncate">{s.label}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[var(--color-muted)] tabular-nums">
                  {s.percentage.toFixed(1)}%
                </span>
                <span className="text-[var(--color-fg)] tabular-nums w-20 text-right">
                  {formatCurrency(s.amount, true)}
                </span>
              </div>
            </div>
          </MagicItem>
        ))}
      </div>
    </WidgetFrame>
  );
}

function BarSegment({
  color,
  percent,
  index,
}: {
  color: string;
  percent: number;
  index: number;
}) {
  const animate = useAnimate();
  if (!animate) {
    return (
      <div
        className="h-full"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    );
  }
  return (
    <motion.div
      className="h-full"
      style={{ backgroundColor: color }}
      initial={{ width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{
        delay: 0.05 * index,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
    />
  );
}
