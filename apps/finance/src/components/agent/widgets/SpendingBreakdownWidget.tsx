"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame, WidgetLabel } from "./primitives";

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

const PERIOD_LABEL: Record<string, string> = {
  this_month: "This month",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
};

export default function SpendingBreakdownWidget({ data }: { data: SpendingBreakdownData }) {
  if (data.error) return <WidgetError message={data.error} />;

  const period = PERIOD_LABEL[data.period] ?? data.period;
  const top = data.categories.slice(0, 8);

  return (
    <WidgetFrame>
      <WidgetLabel
        left={`Spending · ${period}`}
        right={formatCurrency(data.total_spending)}
      />

      {top.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">No spending in this period.</div>
      ) : (
        <>
          {/* Composite stacked bar — animates each segment in sequence so
              it feels like the breakdown is being assembled. */}
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-alt)]/60 flex mb-3">
            {top.map((c, i) => (
              <motion.div
                key={c.label}
                className="h-full"
                style={{ backgroundColor: c.color }}
                initial={{ width: 0 }}
                animate={{ width: `${c.percent}%` }}
                transition={{
                  delay: 0.05 * i,
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            ))}
          </div>

          <div className="space-y-1.5">
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
