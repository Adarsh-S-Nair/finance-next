"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import Card from "../ui/Card";
import { formatCurrency } from "../../lib/formatCurrency";

/**
 * Visual breakdown of a user's monthly income across budget categories.
 * Renders a segmented bar where each segment represents an allocated
 * budget, plus an "unallocated" trailing segment for whatever income is
 * left over. Hovering a segment or list row dims the others to make it
 * easy to see how a single category fits in.
 */
export default function BudgetAllocationBar({
  budgets,
  monthlyIncome,
  incomeMonths = [],
  incomeLoading = false,
  onDelete,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const totalAllocated = useMemo(
    () => budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0),
    [budgets]
  );

  // Sort largest first so the bar reads most-significant to least.
  const sortedBudgets = useMemo(
    () =>
      [...budgets].sort(
        (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
      ),
    [budgets]
  );

  const income = Number(monthlyIncome || 0);
  const hasIncome = income > 0;
  const unallocated = Math.max(0, income - totalAllocated);
  const overAllocated = Math.max(0, totalAllocated - income);

  // Bar normalizes against income when it's larger, otherwise against
  // total allocated so segments still fill the bar visually.
  const barTotal = Math.max(income, totalAllocated);

  const getColor = (b) => {
    const isGroup = !!b.category_groups;
    if (isGroup) return b.category_groups?.hex_color || "#71717a";
    return b.system_categories?.hex_color || "#71717a";
  };

  const getLabel = (b) => {
    const isGroup = !!b.category_groups;
    return isGroup
      ? b.category_groups.name
      : b.system_categories?.label || "Unknown";
  };

  const getIcon = (b) => {
    const isGroup = !!b.category_groups;
    const iconName = isGroup ? b.category_groups?.icon_name : null;
    return iconName && Icons[iconName] ? Icons[iconName] : Icons.Wallet;
  };

  return (
    <Card padding="lg" className="space-y-7">
      {/* Summary header */}
      <div className="flex items-start justify-between flex-wrap gap-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-fg)]">
            Monthly allocation
          </h2>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            How your average income is split across budgets.
          </p>
        </div>

        <div className="flex items-center gap-8">
          <SummaryStat
            label="Income"
            value={hasIncome ? formatCurrency(income) : "—"}
            loading={incomeLoading}
          />
          <SummaryStat
            label="Allocated"
            value={formatCurrency(totalAllocated)}
          />
          <SummaryStat
            label={overAllocated > 0 ? "Over budget" : "Unallocated"}
            value={formatCurrency(overAllocated > 0 ? overAllocated : unallocated)}
            tone={overAllocated > 0 ? "danger" : "default"}
            loading={incomeLoading && !overAllocated}
          />
        </div>
      </div>

      {/* Income breakdown chart */}
      {!incomeLoading && incomeMonths.length > 0 && (
        <IncomeBreakdownChart months={incomeMonths} avg={income} />
      )}

      {/* Segmented bar */}
      <div className="space-y-2">
        <div className="relative h-9 w-full rounded-full overflow-hidden bg-[var(--color-border)] flex">
          {sortedBudgets.map((b) => {
            const pct = barTotal > 0 ? (Number(b.amount) / barTotal) * 100 : 0;
            if (pct <= 0) return null;
            const isHovered = hoveredId === b.id;
            const isDimmed = hoveredId !== null && !isHovered;
            return (
              <motion.div
                key={b.id}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full cursor-pointer"
                style={{
                  backgroundColor: getColor(b),
                  opacity: isDimmed ? 0.25 : 1,
                  transition: "opacity 0.2s ease",
                }}
                onMouseEnter={() => setHoveredId(b.id)}
                onMouseLeave={() => setHoveredId(null)}
                title={`${getLabel(b)} · ${formatCurrency(Number(b.amount))}`}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-[10px] text-[var(--color-muted)] tabular-nums font-medium">
          <span>$0</span>
          <span>{formatCurrency(barTotal)}</span>
        </div>
      </div>

      {/* Per-budget rows */}
      <div className="border-t border-[var(--color-border)] pt-4 -mb-1">
        {sortedBudgets.map((b) => {
          const Icon = getIcon(b);
          const color = getColor(b);
          const label = getLabel(b);
          const allocPct =
            hasIncome && Number(b.amount) > 0
              ? (Number(b.amount) / income) * 100
              : 0;
          const spent = Number(b.spent || 0);
          const spendPct = Number(b.percentage || 0);
          const isHovered = hoveredId === b.id;
          const isDimmed = hoveredId !== null && !isHovered;

          let progressColor = color;
          if (spendPct >= 100) progressColor = "var(--color-danger)";
          else if (spendPct >= 85) progressColor = "#f59e0b";

          return (
            <div
              key={b.id}
              className="flex items-center gap-4 px-3 py-3 -mx-3 rounded-lg group hover:bg-[var(--color-surface-alt)] cursor-pointer relative"
              style={{
                opacity: isDimmed ? 0.45 : 1,
                transition:
                  "opacity 0.2s ease, background-color 0.15s ease",
              }}
              onMouseEnter={() => setHoveredId(b.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Color stripe */}
              <div
                className="w-1 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />

              {/* Icon */}
              <div className="p-2 rounded-lg bg-[var(--color-surface-alt)] text-[var(--color-fg)] flex-shrink-0">
                <Icon size={16} />
              </div>

              {/* Label + spending progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-[var(--color-fg)] truncate">
                    {label}
                  </p>
                  {hasIncome && (
                    <span className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
                      {allocPct.toFixed(0)}% of income
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(spendPct, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: progressColor }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
                    {spendPct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Amount */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(Number(b.amount))}
                </p>
                <p className="text-[11px] text-[var(--color-muted)] tabular-nums">
                  {formatCurrency(spent)} spent
                </p>
              </div>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(b.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--color-muted)] hover:text-rose-500 rounded transition-opacity"
                title="Delete budget"
              >
                <Icons.Trash2 size={14} />
              </button>
            </div>
          );
        })}

        {/* Unallocated row */}
        {hasIncome && unallocated > 0 && (
          <div
            className="flex items-center gap-4 px-3 py-3 -mx-3 rounded-lg"
            style={{
              opacity: hoveredId !== null ? 0.45 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <div className="w-1 h-10 rounded-full flex-shrink-0 bg-[var(--color-border)]" />
            <div className="p-2 rounded-lg bg-[var(--color-surface-alt)] text-[var(--color-muted)] flex-shrink-0">
              <Icons.PiggyBank size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-[var(--color-muted)] truncate">
                  Unallocated
                </p>
                <span className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
                  {((unallocated / income) * 100).toFixed(0)}% of income
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-1">
                Free to save, invest, or budget later.
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-[var(--color-muted)] tabular-nums">
                {formatCurrency(unallocated)}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function IncomeBreakdownChart({ months, avg }) {
  // Sort oldest → newest for a natural left-to-right reading.
  const sorted = [...months].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });

  const maxEarning = Math.max(
    avg || 0,
    ...sorted.map((m) => Number(m.earning || 0))
  );
  const hasAnyEarning = maxEarning > 0;
  const hasZeroMonth = sorted.some((m) => Number(m.earning || 0) === 0);
  const chartHeight = 72;

  const avgPct = hasAnyEarning ? ((avg || 0) / maxEarning) * 100 : 0;

  return (
    <div className="border-t border-[var(--color-border)] pt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
          How this was calculated
        </div>
        <div className="text-[11px] text-[var(--color-muted)]">
          Average of {sorted.length} month{sorted.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="relative" style={{ height: `${chartHeight}px` }}>
        {/* Dashed average line */}
        {avg > 0 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{ bottom: `${avgPct}%` }}
          >
            <div className="border-t border-dashed border-[var(--color-fg)] opacity-40" />
            <span className="absolute right-0 -top-4 text-[10px] tabular-nums text-[var(--color-muted)] bg-[var(--color-surface)] px-1">
              avg {formatCurrency(avg)}
            </span>
          </div>
        )}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-2">
          {sorted.map((m, i) => {
            const earning = Number(m.earning || 0);
            const heightPct = hasAnyEarning
              ? Math.max((earning / maxEarning) * 100, earning > 0 ? 4 : 0)
              : 0;
            const isZero = earning === 0;
            return (
              <div
                key={`${m.year}-${m.monthNumber}-${i}`}
                className="flex-1 h-full flex items-end"
                title={`${m.formattedMonth || m.monthName}: ${formatCurrency(earning)}`}
              >
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${heightPct}%`,
                    minHeight: isZero ? 0 : 3,
                    backgroundColor: isZero
                      ? "var(--color-border)"
                      : "var(--color-fg)",
                    opacity: isZero ? 1 : 0.85,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Month labels */}
      <div className="flex gap-2 mt-2">
        {sorted.map((m, i) => {
          const earning = Number(m.earning || 0);
          const isZero = earning === 0;
          return (
            <div
              key={`label-${m.year}-${m.monthNumber}-${i}`}
              className="flex-1 flex flex-col items-center"
            >
              <span
                className="text-[10px] tabular-nums"
                style={{
                  color: isZero
                    ? "var(--color-muted)"
                    : "var(--color-fg)",
                }}
              >
                {isZero ? "—" : formatCurrencyCompact(earning)}
              </span>
              <span className="text-[10px] text-[var(--color-muted)] mt-0.5">
                {(m.monthName || "").slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>

      {hasZeroMonth && (
        <p className="text-[11px] text-[var(--color-muted)] mt-3 leading-relaxed">
          A $0 month usually means an account wasn&apos;t connected yet, or
          income was routed somewhere we can&apos;t see. Connect more
          institutions for a more accurate average.
        </p>
      )}
    </div>
  );
}

// Compact currency formatter: $6,514 → $6.5k. Used in cramped chart labels.
function formatCurrencyCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 10000) {
    return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return formatCurrency(value);
}

function SummaryStat({ label, value, tone = "default", loading = false }) {
  const valueColor =
    tone === "danger" ? "var(--color-danger)" : "var(--color-fg)";
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium">
        {label}
      </p>
      {loading ? (
        <div className="h-5 w-16 mt-1 rounded bg-[var(--color-border)] animate-pulse ml-auto" />
      ) : (
        <p
          className="text-lg font-semibold tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </p>
      )}
    </div>
  );
}
