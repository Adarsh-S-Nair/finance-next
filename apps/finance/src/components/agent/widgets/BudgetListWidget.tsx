"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame, WidgetLabel } from "./primitives";

type Budget = {
  id?: string;
  label: string;
  hex_color: string;
  budget_amount: number;
  spent: number;
  remaining: number;
  percent_used: number;
};

export type BudgetListData = {
  month?: string;
  budgets: Budget[];
  total_budgeted?: number;
  total_spent?: number;
  over_budget_count?: number;
  error?: string;
};

export default function BudgetListWidget({ data }: { data: BudgetListData }) {
  if (data.error) return <WidgetError message={data.error} />;

  if (!data.budgets || data.budgets.length === 0) {
    return (
      <WidgetFrame>
        <WidgetLabel left={data.month ? `Budgets · ${data.month}` : "Budgets"} />
        <div className="text-xs text-[var(--color-muted)]">No budgets set up.</div>
      </WidgetFrame>
    );
  }

  const right =
    (data.total_budgeted ?? 0) > 0
      ? `${formatCurrency(data.total_spent ?? 0)} / ${formatCurrency(data.total_budgeted ?? 0)}`
      : undefined;

  return (
    <WidgetFrame>
      <WidgetLabel
        left={data.month ? `Budgets · ${data.month}` : "Budgets"}
        right={right}
      />
      <div className="space-y-3">
        {data.budgets.map((b, i) => (
          <MagicItem key={b.id ?? `${b.label}-${i}`} index={i}>
            <BudgetRow budget={b} delay={i * 0.04} />
          </MagicItem>
        ))}
      </div>
    </WidgetFrame>
  );
}

function BudgetRow({ budget, delay }: { budget: Budget; delay: number }) {
  const over = budget.spent > budget.budget_amount;
  const pct = Math.min(budget.percent_used, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: budget.hex_color }}
            aria-hidden
          />
          <span className="text-sm text-[var(--color-fg)] truncate">
            {budget.label}
          </span>
        </div>
        <span
          className={`text-xs tabular-nums flex-shrink-0 ${
            over ? "text-rose-500" : "text-[var(--color-muted)]"
          }`}
        >
          {formatCurrency(budget.spent)} / {formatCurrency(budget.budget_amount)}
        </span>
      </div>
      <div className="w-full h-1 rounded-full bg-[var(--color-surface-alt)]/60 overflow-hidden">
        <motion.div
          className="h-full"
          style={{ backgroundColor: over ? "#f87171" : budget.hex_color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
