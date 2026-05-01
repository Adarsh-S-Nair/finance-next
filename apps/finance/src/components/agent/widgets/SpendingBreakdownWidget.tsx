"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame, useAnimate } from "./primitives";

type Category = {
  label: string;
  total: number;
  color: string;
  percent: number;
};

export type SpendingBreakdownData = {
  period: "this_month" | "last_30_days" | "last_90_days";
  start: string;
  end: string;
  categories: Category[];
  total_spending: number;
  error?: string;
};

export default function SpendingBreakdownWidget({ data }: { data: SpendingBreakdownData }) {
  if (data.error) return <WidgetError message={data.error} />;

  const top = data.categories.slice(0, 8);

  return (
    <WidgetFrame>
      {top.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">No spending in this period.</div>
      ) : (
        <>
          {/* Composite stacked bar — animates each segment in sequence so
              it feels like the breakdown is being assembled. */}
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-alt)]/60 flex mb-4">
            {top.map((c, i) => (
              <BarSegment key={c.label} color={c.color} percent={c.percent} index={i} />
            ))}
          </div>

          <div className="space-y-2.5">
            {top.map((c, i) => (
              <MagicItem key={c.label} index={i}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    <span className="text-[var(--color-fg)] truncate">{c.label}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[var(--color-muted)] tabular-nums">
                      {c.percent}%
                    </span>
                    <span className="text-[var(--color-fg)] tabular-nums w-16 text-right">
                      {formatCurrency(c.total)}
                    </span>
                  </div>
                </div>
              </MagicItem>
            ))}
          </div>
        </>
      )}
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
