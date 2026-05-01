"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";

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
  if (data.error) {
    return (
      <div className="my-3 px-4 py-3 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 text-xs text-[var(--color-danger)]">
        {data.error}
      </div>
    );
  }

  const period = PERIOD_LABEL[data.period] ?? data.period;
  const top = data.categories.slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-3 rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-content-bg)] overflow-hidden"
    >
      <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-border)]/30 bg-[var(--color-surface-alt)]/30 flex items-center justify-between">
        <span>Spending by category · {period}</span>
        <span className="tabular-nums normal-case tracking-normal text-[var(--color-muted)]/80">
          {formatCurrency(data.total_spending)}
        </span>
      </div>

      {/* Composite stacked bar showing all categories at once. */}
      <div className="px-4 pt-3">
        <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--color-surface-alt)]/70 flex">
          {top.map((c, i) => (
            <motion.div
              key={c.label}
              className="h-full"
              style={{ backgroundColor: c.color }}
              initial={{ width: 0 }}
              animate={{ width: `${c.percent}%` }}
              transition={{ delay: 0.05 * i, duration: 0.4, ease: "easeOut" }}
            />
          ))}
        </div>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        {top.length === 0 ? (
          <div className="text-xs text-[var(--color-muted)] text-center py-3">
            No spending in this period.
          </div>
        ) : (
          top.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 * i + 0.15, duration: 0.2 }}
              className="flex items-center justify-between gap-3 text-xs"
            >
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
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
