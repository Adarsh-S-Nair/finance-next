"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";

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
  if (data.error) {
    return <ErrorRow message={data.error} />;
  }

  if (!data.budgets || data.budgets.length === 0) {
    return (
      <WidgetShell label={data.month ? `Budgets · ${data.month}` : "Budgets"}>
        <div className="px-4 py-6 text-xs text-[var(--color-muted)] text-center">
          No budgets set up yet.
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell label={data.month ? `Budgets · ${data.month}` : "Budgets"}>
      <div className="divide-y divide-[var(--color-border)]/40">
        {data.budgets.map((b, i) => (
          <BudgetRow key={b.id ?? `${b.label}-${i}`} budget={b} index={i} />
        ))}
      </div>
      {(data.total_budgeted ?? 0) > 0 && (
        <div className="px-4 py-2.5 flex items-center justify-between bg-[var(--color-surface-alt)]/30 text-xs">
          <span className="text-[var(--color-muted)]">Total</span>
          <span className="tabular-nums text-[var(--color-fg)] font-medium">
            {formatCurrency(data.total_spent ?? 0)} / {formatCurrency(data.total_budgeted ?? 0)}
          </span>
        </div>
      )}
    </WidgetShell>
  );
}

function BudgetRow({ budget, index }: { budget: Budget; index: number }) {
  const over = budget.spent > budget.budget_amount;
  const pct = Math.min(budget.percent_used, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.2 }}
      className="px-4 py-3"
    >
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
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
      <div className="w-full h-1 rounded-full bg-[var(--color-surface-alt)]/70 overflow-hidden">
        <motion.div
          className="h-full"
          style={{ backgroundColor: over ? "#f87171" : budget.hex_color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.05 * index + 0.1, duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

function WidgetShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-3 rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-content-bg)] overflow-hidden"
    >
      <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-border)]/30 bg-[var(--color-surface-alt)]/30">
        {label}
      </div>
      {children}
    </motion.div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="my-3 px-4 py-3 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 text-xs text-[var(--color-danger)]">
      {message}
    </div>
  );
}
