"use client";

import { useState } from "react";
import { WidgetError, WidgetFrame } from "./primitives";
import InteractiveDonut, {
  type DonutSegment,
} from "../../InteractiveDonut";

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

const PCT_SUFFIX: Record<string, string> = {
  asset_class: "of portfolio",
  sector: "of portfolio",
  account: "of portfolio",
};

// Donut shrunk down from the dashboard's 220px so the widget fits
// comfortably next to the line chart in the agent's two-column layout
// without dominating it.
const DONUT_SIZE = 160;
const DONUT_STROKE = 14;

export default function PortfolioBreakdownWidget({
  data,
}: {
  data: PortfolioBreakdownData;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // Build donut segments. Use the label as the id since the upstream
  // segments are already deduped by label.
  const donutSegments: DonutSegment[] = segments.map((s) => ({
    id: s.label,
    label: s.label,
    value: s.amount,
    color: colorFor(s.label, breakdownBy),
  }));

  return (
    <WidgetFrame>
      <div className="flex flex-col items-center gap-4">
        <InteractiveDonut
          segments={donutSegments}
          total={total}
          centerLabel={BREAKDOWN_LABEL[breakdownBy] ?? "Breakdown"}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          size={DONUT_SIZE}
          strokeWidth={DONUT_STROKE}
          pctSuffix={PCT_SUFFIX[breakdownBy] ?? "of total"}
        />

        {/* Tight legend below the donut. Hovering a row cross-highlights
            the matching slice (and vice versa) — same pattern as the
            spending donut's row list on the dashboard. */}
        <div className="w-full space-y-1.5">
          {donutSegments.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            const isHovered = hoveredId === s.id;
            const dimmed = hoveredId && !isHovered;
            return (
              <div
                key={s.id}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="flex items-center justify-between gap-3 text-xs"
                style={{
                  opacity: dimmed ? 0.5 : 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="text-[var(--color-fg)] truncate">{s.label}</span>
                </div>
                <span className="text-[var(--color-muted)] tabular-nums flex-shrink-0">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetFrame>
  );
}
