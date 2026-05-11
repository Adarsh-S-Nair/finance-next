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

// Donut shrunk down from the dashboard's 220px so the widget sits
// compactly in the narrow column of the chart-paired layout. Smaller
// stroke too — at 130px the dashboard's 16px ring would feel chunky.
const DONUT_SIZE = 130;
const DONUT_STROKE = 12;

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

  // No static legend — the center swap on hover already labels each
  // slice. Saves vertical space and matches the dashboard's spending
  // donut, which also leans on hover for per-slice detail.
  return (
    <WidgetFrame>
      <div className="flex items-center justify-center">
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
      </div>
    </WidgetFrame>
  );
}
