"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Tooltip } from "@zervo/ui";
import { formatCurrency } from "../../lib/formatCurrency";
import type { AllocatedGoal } from "./types";

type Props = {
  allocated: AllocatedGoal[];
  unallocated: number;
  cashPool: number;
};

export default function CashAllocationStrip({
  allocated,
  unallocated,
  cashPool,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const totalAllocated = allocated.reduce((sum, g) => sum + g.allocated, 0);
  const segments = allocated.filter((g) => g.allocated > 0);
  const denom = Math.max(cashPool, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="card-header mb-2">Cash allocation</div>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight tabular-nums">
          {formatCurrency(totalAllocated)}
          <span className="text-sm text-[var(--color-muted)] font-normal">
            {" "}
            of {formatCurrency(cashPool)}
          </span>
        </div>
        {unallocated > 0 && (
          <div className="text-xs text-[var(--color-muted)] tabular-nums whitespace-nowrap">
            {formatCurrency(unallocated)} unallocated
          </div>
        )}
      </div>

      {/* Thicker strip — 12px instead of 8px so it carries the visual weight
          of the section. Each segment animates its width on mount. */}
      <div
        className="relative h-3 w-full rounded-full overflow-hidden flex bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]"
        onMouseLeave={() => setHoveredId(null)}
      >
        {segments.map((g, i) => {
          const widthPct = (g.allocated / denom) * 100;
          const isHovered = hoveredId === g.id;
          return (
            <Tooltip
              key={g.id}
              side="top"
              content={
                <div className="text-xs">
                  <div className="font-medium text-[var(--color-fg)]">
                    {g.name}
                  </div>
                  <div className="text-[var(--color-muted)] tabular-nums mt-0.5">
                    {formatCurrency(g.allocated)} of {formatCurrency(g.target)}
                    {" · "}
                    {(g.progress * 100).toFixed(0)}%
                  </div>
                </div>
              }
            >
              <motion.button
                type="button"
                onMouseEnter={() => setHoveredId(g.id)}
                initial={{ width: 0 }}
                animate={{
                  width: `${widthPct}%`,
                  opacity: hoveredId && !isHovered ? 0.5 : 1,
                }}
                transition={{
                  width: { delay: 0.1 + i * 0.06, duration: 0.7, ease: "easeOut" },
                  opacity: { duration: 0.15 },
                }}
                className="relative h-full cursor-pointer"
                style={{ backgroundColor: g.color }}
                aria-label={`${g.name}: ${formatCurrency(g.allocated)} of ${formatCurrency(g.target)}`}
              />
            </Tooltip>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--color-muted)] flex-wrap">
        {segments.map((g) => (
          <button
            key={g.id}
            type="button"
            onMouseEnter={() => setHoveredId(g.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`flex items-center gap-1.5 transition-opacity ${
              hoveredId && hoveredId !== g.id ? "opacity-50" : ""
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            <span className="truncate max-w-[8rem]">{g.name}</span>
          </button>
        ))}
        {unallocated > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_85%)]" />
            <span>Unallocated</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}
