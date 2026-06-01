"use client";

import React, { useEffect, useRef } from "react";
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
 * the investments/accounts charts — an animated accent pill behind the
 * active month — but adds disabled support so future months in the
 * selected year aren't clickable.
 *
 * On desktop the twelve months share the full width in equal-width
 * cells. On mobile that's too cramped to read, so the strip instead
 * scrolls horizontally (scrollbar hidden) with comfortably spaced
 * months, and the active month is kept centered in view.
 */
export default function MonthStrip({
  months,
  activeValue,
  onSelect,
  layoutId = "spending-month-strip",
  className = "",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the selected month centered within the horizontal scroll area
  // on mobile. We adjust the container's scrollLeft directly (rather
  // than scrollIntoView) so the page's vertical scroll position is
  // never disturbed. No-ops on desktop where everything already fits.
  useEffect(() => {
    const container = scrollRef.current;
    const el = activeRef.current;
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.left - containerRect.left + container.scrollLeft;
    const target = offset - container.clientWidth / 2 + elRect.width / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeValue]);

  return (
    <div
      ref={scrollRef}
      className={`flex items-center w-full overflow-x-auto scrollbar-hide lg:overflow-x-visible ${className}`}
    >
      {months.map((m) => {
        const isActive = m.value === activeValue && !m.disabled;
        return (
          <div
            key={m.value}
            className="flex-shrink-0 lg:flex-1 flex justify-center"
          >
            <button
              ref={isActive ? activeRef : undefined}
              type="button"
              disabled={m.disabled}
              onClick={() => {
                if (!m.disabled) onSelect(m.value);
              }}
              className={`relative px-3 py-1.5 lg:px-2 lg:py-1 text-[11px] lg:text-[10px] font-bold rounded-full transition-colors text-center outline-none focus:outline-none ${
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
