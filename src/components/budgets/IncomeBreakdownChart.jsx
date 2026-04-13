"use client";

import React from "react";
import { formatCurrency } from "../../lib/formatCurrency";

/**
 * Compact bar chart showing each month of income that fed into the
 * budget income average, with a dashed line marking the average itself.
 * Designed to live inline (no card wrapper) so it can drop into any
 * surface — the BudgetAllocationBar card, the create-budget overlay, etc.
 *
 * Months with $0 income render as flat dimmed bars with a "—" label so
 * sync gaps and direct-deposit transitions are immediately visible.
 *
 * @param {Object[]} months - Array of monthly income data:
 *   { year, monthNumber, monthName, formattedMonth, earning }
 * @param {number} avg - The average value to overlay as a dashed line.
 * @param {string} [labelBg] - CSS color for the avg-label background pill
 *   (so it stays legible against whichever surface this is rendered on).
 *   Defaults to var(--color-surface).
 */
export default function IncomeBreakdownChart({
  months,
  avg,
  labelBg = "var(--color-surface)",
}) {
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
    <div>
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
            <span
              className="absolute right-0 -top-4 text-[10px] tabular-nums text-[var(--color-muted)] px-1"
              style={{ backgroundColor: labelBg }}
            >
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
                  color: isZero ? "var(--color-muted)" : "var(--color-fg)",
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
