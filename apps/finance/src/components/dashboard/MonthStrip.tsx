"use client";

import React from "react";
import { motion } from "framer-motion";

export type MonthStripItem = {
  /** Canonical value, e.g. "2026-05". */
  value: string;
  /** Display label, e.g. "MAY". */
  label: string;
  /** Future months (not yet reached) are rendered faint + non-clickable. */
  disabled?: boolean;
};

type Props = {
  months: MonthStripItem[];
  activeValue: string | null;
  onSelect: (value: string) => void;
  /** Shared layout id for the animated active pill. */
  layoutId?: string;
  className?: string;
};

/**
 * Horizontal month selector that sits under the spending section's
 * line chart + donut. Mirrors the TimeRangeSelector treatment used on
 * the investments/accounts charts — equal-width cells, an animated
 * accent pill behind the active month — but adds disabled support so
 * future months in the selected year aren't clickable.
 */
export default function MonthStrip({
  months,
  activeValue,
  onSelect,
  layoutId = "spending-month-strip",
  className = "",
}: Props) {
  return (
    <div className={`flex items-center w-full ${className}`}>
      {months.map((m) => {
        const isActive = m.value === activeValue && !m.disabled;
        return (
          <div key={m.value} className="flex-1 flex justify-center">
            <button
              type="button"
              disabled={m.disabled}
              onClick={() => {
                if (!m.disabled) onSelect(m.value);
              }}
              className={`relative px-2 py-1 text-[10px] font-bold rounded-full transition-colors text-center outline-none focus:outline-none ${
                m.disabled ? "cursor-default" : "cursor-pointer"
              }`}
              style={{
                color: m.disabled
                  ? "var(--color-border)"
                  : isActive
                    ? "var(--color-on-accent)"
                    : "var(--color-muted)",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 bg-[var(--color-accent)] rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 ${
                  !isActive && !m.disabled ? "hover:text-[var(--color-fg)]" : ""
                }`}
              >
                {m.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
