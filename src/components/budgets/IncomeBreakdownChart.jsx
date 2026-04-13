"use client";

import React from "react";
import { formatCurrency } from "../../lib/formatCurrency";

/**
 * Minimal bar chart showing monthly income. Thin centered bars with bold
 * dollar amounts above each bar and the month label below.
 *
 * @param {Object[]} months - { year, monthNumber, monthName, earning }
 * @param {number} [avg] - Optional average to show as a subtle annotation.
 */
export default function IncomeBreakdownChart({ months, avg }) {
  const sorted = [...months].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });

  const maxEarning = Math.max(...sorted.map((m) => Number(m.earning || 0)));
  const hasZeroMonth = sorted.some((m) => Number(m.earning || 0) === 0);
  const BAR_MAX_HEIGHT = 72;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          {sorted.length === 1 ? "Last month" : `Last ${sorted.length} months`}
        </div>
        {avg > 0 && sorted.length > 1 && (
          <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
            avg {formatCurrency(avg)}
          </span>
        )}
      </div>

      <div className="flex items-end gap-6">
        {sorted.map((m, i) => {
          const earning = Number(m.earning || 0);
          const isZero = earning === 0;
          const heightPx =
            maxEarning > 0
              ? Math.max((earning / maxEarning) * BAR_MAX_HEIGHT, isZero ? 0 : 6)
              : 0;

          return (
            <div
              key={`${m.year}-${m.monthNumber}-${i}`}
              className="flex-1 flex flex-col items-center gap-1.5"
            >
              <span
                className="text-xs tabular-nums"
                style={{
                  fontWeight: isZero ? 400 : 600,
                  color: isZero
                    ? "var(--color-muted)"
                    : "var(--color-fg)",
                }}
              >
                {isZero ? "\u2014" : formatCurrencyCompact(earning)}
              </span>
              <div
                className="w-5 rounded-sm"
                style={{
                  height: `${heightPx}px`,
                  backgroundColor: isZero
                    ? "var(--color-border)"
                    : "var(--color-fg)",
                  opacity: isZero ? 1 : 0.15,
                }}
              />
              <span className="text-[11px] text-[var(--color-muted)]">
                {(m.monthName || "").slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>

      {hasZeroMonth && (
        <p className="text-[11px] text-[var(--color-muted)] mt-4 leading-relaxed">
          A $0 month usually means an account wasn&apos;t connected yet.
          Connect more institutions for a more accurate average.
        </p>
      )}
    </div>
  );
}

function formatCurrencyCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 10000) {
    return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return formatCurrency(value);
}
