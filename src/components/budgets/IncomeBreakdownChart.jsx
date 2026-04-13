"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { formatCurrency } from "../../lib/formatCurrency";

/**
 * Minimal bar chart showing monthly income. Thin centered bars with bold
 * dollar amounts above each bar and the month label below.
 *
 * When `onAverageChange` is provided, bars become toggleable — click to
 * exclude a month from the average calculation. Excluded bars render muted.
 *
 * @param {Object[]} months  - { year, monthNumber, monthName, earning }
 * @param {number}   [avg]   - Optional average annotation (read-only contexts).
 * @param {function} [onAverageChange] - Callback with recalculated average
 *   when the user toggles months. Enables interactive mode.
 */
export default function IncomeBreakdownChart({ months, avg, onAverageChange }) {
  const sorted = [...months].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });

  const interactive = typeof onAverageChange === "function";

  // Track which month indices are excluded (only relevant when interactive).
  const [excluded, setExcluded] = useState(new Set());

  const toggle = useCallback(
    (idx) => {
      if (!interactive) return;
      setExcluded((prev) => {
        const next = new Set(prev);
        // Don't allow excluding all months
        if (!next.has(idx)) {
          const includedCount = sorted.length - next.size;
          if (includedCount <= 1) return prev;
          next.add(idx);
        } else {
          next.delete(idx);
        }
        return next;
      });
    },
    [interactive, sorted.length]
  );

  // Recalculate average and notify parent whenever exclusions change.
  useEffect(() => {
    if (!interactive) return;
    const included = sorted.filter((_, i) => !excluded.has(i));
    const total = included.reduce((s, m) => s + Number(m.earning || 0), 0);
    const newAvg = included.length > 0 ? Math.round(total / included.length) : 0;
    onAverageChange(newAvg);
  }, [excluded, interactive, sorted, onAverageChange]);

  const maxEarning = Math.max(...sorted.map((m) => Number(m.earning || 0)));
  const hasZeroMonth = sorted.some((m) => Number(m.earning || 0) === 0);
  const BAR_MAX_HEIGHT = 72;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          {sorted.length === 1 ? "Last month" : `Last ${sorted.length} months`}
        </div>
        {avg > 0 && sorted.length > 1 && !interactive && (
          <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
            avg {formatCurrency(avg)}
          </span>
        )}
        {interactive && (
          <span className="text-[10px] text-[var(--color-muted)]">
            tap to exclude
          </span>
        )}
      </div>

      <div className="flex items-end gap-3">
        {sorted.map((m, i) => {
          const earning = Number(m.earning || 0);
          const isZero = earning === 0;
          const isExcluded = excluded.has(i);
          const heightPx =
            maxEarning > 0
              ? Math.max((earning / maxEarning) * BAR_MAX_HEIGHT, isZero ? 4 : 6)
              : 4;

          return (
            <motion.div
              key={`${m.year}-${m.monthNumber}-${i}`}
              className={`flex-1 flex flex-col items-center gap-1.5 ${
                interactive ? "cursor-pointer select-none" : ""
              }`}
              onClick={() => toggle(i)}
              whileHover={interactive ? { scale: 1.06 } : undefined}
              whileTap={interactive ? { scale: 0.92 } : undefined}
              transition={
                interactive
                  ? { type: "spring", stiffness: 500, damping: 15 }
                  : undefined
              }
            >
              <motion.span
                className="text-xs tabular-nums"
                animate={{
                  opacity: isExcluded ? 0.35 : 1,
                }}
                transition={{ duration: 0.2 }}
                style={{
                  fontWeight: isZero && !isExcluded ? 400 : isExcluded ? 400 : 600,
                  color:
                    isExcluded || isZero
                      ? "var(--color-muted)"
                      : "var(--color-fg)",
                }}
              >
                {isZero ? "$0" : formatCurrencyCompact(earning)}
              </motion.span>
              <motion.div
                className="w-5 rounded-sm"
                animate={{
                  height: heightPx,
                  opacity: isExcluded ? 0.08 : isZero ? 0.12 : 0.25,
                }}
                transition={
                  interactive
                    ? { type: "spring", stiffness: 400, damping: 20 }
                    : { duration: 0.2 }
                }
                style={{
                  backgroundColor: isZero
                    ? "var(--color-border)"
                    : "var(--color-fg)",
                }}
              />
              <motion.span
                className="text-[11px]"
                animate={{
                  opacity: isExcluded ? 0.35 : 1,
                  textDecorationLine: isExcluded ? "line-through" : "none",
                }}
                transition={{ duration: 0.2 }}
                style={{ color: "var(--color-muted)" }}
              >
                {(m.monthName || "").slice(0, 3)}
              </motion.span>
            </motion.div>
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
