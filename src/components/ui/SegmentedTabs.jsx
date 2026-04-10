"use client";

import React, { useMemo } from "react";

/**
 * SegmentedTabs — compact, controlled segmented control / connected tabs.
 *
 * Props:
 *   options: Array<{ label: string, value: string }>
 *   value: string
 *   onChange: (value: string) => void
 *   size: 'xs' | 'sm' | 'md'  (default 'sm')
 *   className: string         (applied to the outer container)
 */
export default function SegmentedTabs({
  options = [],
  value,
  onChange,
  size = "sm",
  className = "",
}) {
  const activeIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value]
  );

  const sizeClasses = {
    xs: "text-[10px] px-2 py-1",
    sm: "text-[11px] px-2.5 py-1",
    md: "text-xs px-3 py-1.5",
  };
  const buttonSize = sizeClasses[size] || sizeClasses.sm;

  if (!options.length) return null;

  return (
    <div
      className={`inline-flex items-center rounded-lg p-0.5 bg-[var(--color-surface-alt)] ${className}`}
    >
      <div className="relative">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange?.(opt.value)}
                className={`relative z-10 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${buttonSize} ${
                  isActive
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 z-0 rounded-md bg-[var(--color-surface)] shadow-sm border border-[var(--color-border)] transition-all duration-200 ease-out"
            style={{
              width: `${100 / options.length}%`,
              left: `${(100 / options.length) * activeIndex}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
