"use client";

import React from "react";
import { motion } from "framer-motion";

type TimeRangeSelectorProps = {
  ranges: string[];
  activeRange: string;
  onRangeChange: (range: string) => void;
  layoutId: string;
  className?: string;
};

export default function TimeRangeSelector({
  ranges,
  activeRange,
  onRangeChange,
  layoutId,
  className = "",
}: TimeRangeSelectorProps) {
  return (
    <div className={`flex justify-between items-center w-full ${className}`}>
      {ranges.map((range) => {
        const isActive = activeRange === range;
        return (
          <div key={range} className="flex-1 flex justify-center">
            <button
              onClick={() => onRangeChange(range)}
              className="relative px-3 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none focus:outline-none"
              style={{
                color: isActive ? "var(--color-on-accent)" : "var(--color-muted)",
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
                className={`relative z-10 ${!isActive ? "hover:text-[var(--color-fg)]" : ""}`}
              >
                {range}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
