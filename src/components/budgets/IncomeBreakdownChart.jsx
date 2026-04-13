"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "../../lib/formatCurrency";

/**
 * Minimal bar chart showing monthly income. Thin centered bars with bold
 * dollar amounts above each bar and the month label below.
 *
 * When `onAverageChange` is provided, clicking anywhere in a bar's column
 * toggles that month out of the average calculation.
 *
 * `compact` hides the full-width header for inline use beside the average.
 */
export default function IncomeBreakdownChart({
  months,
  avg,
  onAverageChange,
  compact = false,
}) {
  const sorted = [...months].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });

  const interactive = typeof onAverageChange === "function";
  const [excluded, setExcluded] = useState(new Set());

  const toggle = useCallback(
    (idx) => {
      if (!interactive) return;
      setExcluded((prev) => {
        const next = new Set(prev);
        if (!next.has(idx)) {
          if (sorted.length - next.size <= 1) return prev;
          next.add(idx);
        } else {
          next.delete(idx);
        }
        return next;
      });
    },
    [interactive, sorted.length]
  );

  useEffect(() => {
    if (!interactive) return;
    const included = sorted.filter((_, i) => !excluded.has(i));
    const total = included.reduce((s, m) => s + Number(m.earning || 0), 0);
    const newAvg = included.length > 0 ? Math.round(total / included.length) : 0;
    onAverageChange(newAvg);
  }, [excluded, interactive, sorted, onAverageChange]);

  const maxEarning = Math.max(...sorted.map((m) => Number(m.earning || 0)));
  const hasZeroMonth = sorted.some((m) => Number(m.earning || 0) === 0);
  const BAR_MAX_HEIGHT = compact ? 48 : 72;

  return (
    <div>
      {/* Header row */}
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            {sorted.length === 1 ? "Last month" : `Last ${sorted.length} months`}
          </div>
          {avg > 0 && sorted.length > 1 && !interactive && (
            <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
              avg {formatCurrency(avg)}
            </span>
          )}
        </div>
      )}

      {/* "tap to exclude" hint — sits right above the bars, right-aligned */}
      {interactive && compact && (
        <div className="text-[9px] text-[var(--color-muted)] text-right mb-1.5 tracking-wide">
          tap to exclude
        </div>
      )}

      {/* Bars */}
      <div className="flex items-end gap-2.5">
        {sorted.map((m, i) => {
          const earning = Number(m.earning || 0);
          const isZero = earning === 0;
          const isExcluded = excluded.has(i);
          const heightPx =
            maxEarning > 0
              ? Math.max((earning / maxEarning) * BAR_MAX_HEIGHT, isZero ? 4 : 6)
              : 4;

          return (
            <div
              key={`${m.year}-${m.monthNumber}-${i}`}
              className={`flex flex-col items-center gap-1.5 ${
                interactive ? "cursor-pointer select-none" : ""
              }`}
              onClick={() => toggle(i)}
            >
              {/* Amount label */}
              <motion.span
                className="text-[11px] tabular-nums"
                animate={{ opacity: isExcluded ? 0.3 : 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontWeight: isExcluded ? 400 : isZero ? 400 : 600,
                  color:
                    isExcluded || isZero
                      ? "var(--color-muted)"
                      : "var(--color-fg)",
                }}
              >
                {isZero ? "$0" : formatCurrencyCompact(earning)}
              </motion.span>

              {/* Bar */}
              <motion.div
                className="w-6 rounded-sm"
                whileHover={interactive ? { scaleY: 1.1, scaleX: 1.2 } : undefined}
                whileTap={interactive ? { scaleY: 0.85, scaleX: 0.9 } : undefined}
                animate={{
                  height: heightPx,
                  opacity: isExcluded ? 0.15 : 1,
                }}
                transition={
                  interactive
                    ? { type: "spring", stiffness: 500, damping: 18 }
                    : { duration: 0.2 }
                }
                style={{
                  backgroundColor: "var(--color-muted)",
                  originY: 1,
                }}
              />

              {/* Month label */}
              <motion.span
                className="text-[10px]"
                animate={{
                  opacity: isExcluded ? 0.3 : 1,
                  textDecorationLine: isExcluded ? "line-through" : "none",
                }}
                transition={{ duration: 0.2 }}
                style={{ color: "var(--color-muted)" }}
              >
                {(m.monthName || "").slice(0, 3)}
              </motion.span>
            </div>
          );
        })}
      </div>

      {/* Non-compact footer */}
      {!compact && interactive && (
        <p className="text-[10px] text-[var(--color-muted)] mt-3 leading-relaxed">
          Tap a bar to exclude it from the average.
        </p>
      )}

      {!compact && !interactive && hasZeroMonth && (
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
