"use client";

import { motion } from "framer-motion";
import { FiTag } from "react-icons/fi";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { isBudgetOver } from "../../../lib/budget";
import {
  MagicItem,
  WidgetError,
  WidgetFrame,
  WidgetLabel,
  useAnimate,
} from "./primitives";

// Pretty-print "2026-04" as "April 2026". Tool returns yyyy-MM (no day),
// so we fabricate a UTC mid-month date to avoid timezone drift turning
// "2026-04" into "March 2026" for users west of UTC.
function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map((s) => Number(s));
  if (!year || !m) return month;
  const d = new Date(Date.UTC(year, m - 1, 15));
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Budget = {
  id?: string;
  label: string;
  hex_color: string;
  icon_lib: string | null;
  icon_name: string | null;
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
        <div className="text-xs text-[var(--color-muted)]">No budgets set up.</div>
      </WidgetFrame>
    );
  }

  // Show "April 2026 · $63 spent" header so the user can sanity-check
  // which month the agent actually queried. Without this, two widgets for
  // "this month vs last month" looked identical when the model picked the
  // wrong month — there was no way to tell from the rendered output.
  const monthLabel = data.month ? formatMonthLabel(data.month) : null;
  const totalSpent =
    typeof data.total_spent === "number"
      ? formatCurrency(data.total_spent)
      : null;

  return (
    <WidgetFrame>
      {monthLabel ? (
        <WidgetLabel
          left={monthLabel}
          right={totalSpent ? `${totalSpent} spent` : null}
        />
      ) : null}
      <div className="space-y-5">
        {data.budgets.map((b, i) => (
          <MagicItem key={b.id ?? `${b.label}-${i}`} index={i}>
            <BudgetRow budget={b} delay={i * 0.05} />
          </MagicItem>
        ))}
      </div>
    </WidgetFrame>
  );
}

function BudgetRow({ budget, delay }: { budget: Budget; delay: number }) {
  const animate = useAnimate();
  const over = isBudgetOver(budget.spent, budget.budget_amount);
  const pct = Math.min(budget.percent_used, 100);

  return (
    <div className="flex items-center gap-3">
      {/* Icon avatar — same colored circle + DynamicIcon pattern as the
          transaction widget, so budgets and transactions feel like part
          of the same family visually. */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: budget.hex_color }}
      >
        <DynamicIcon
          iconLib={budget.icon_lib}
          iconName={budget.icon_name}
          className="h-4 w-4 text-white"
          fallback={FiTag}
          style={{ strokeWidth: 2.5 }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5 gap-3">
          <span className="text-sm text-[var(--color-fg)] truncate">
            {budget.label}
          </span>
          <span
            className={`text-xs tabular-nums flex-shrink-0 ${
              over ? "text-rose-500" : "text-[var(--color-muted)]"
            }`}
          >
            {formatCurrency(budget.spent)} / {formatCurrency(budget.budget_amount)}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--color-surface-alt)]/60 overflow-hidden">
          {animate ? (
            <motion.div
              className="h-full"
              style={{ backgroundColor: over ? "#f87171" : budget.hex_color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{
                delay: delay + 0.2,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ) : (
            <div
              className="h-full"
              style={{
                width: `${pct}%`,
                backgroundColor: over ? "#f87171" : budget.hex_color,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
