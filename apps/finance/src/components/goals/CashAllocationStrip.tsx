"use client";

import { useState } from "react";
import { LuShield } from "react-icons/lu";
import { Tooltip } from "@zervo/ui";
import { formatCurrency } from "../../lib/formatCurrency";
import type { AllocatedGoal } from "./types";

type Props = {
  allocated: AllocatedGoal[];
  unallocated: number;
  cashPool: number;
};

export default function CashAllocationStrip({ allocated, unallocated, cashPool }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const totalAllocated = allocated.reduce((sum, g) => sum + g.allocated, 0);
  const segments = allocated.filter((g) => g.allocated > 0);
  const denom = Math.max(cashPool, 1);

  const hovered = hoveredId
    ? allocated.find((g) => g.id === hoveredId) ?? null
    : null;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <div className="card-header mb-1">Cash allocation</div>
          <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight tabular-nums">
            {formatCurrency(totalAllocated)}
            <span className="text-sm text-[var(--color-muted)] font-normal">
              {" "}
              of {formatCurrency(cashPool)} available
            </span>
          </div>
        </div>
        {unallocated > 0 && (
          <div className="text-xs text-[var(--color-muted)] tabular-nums whitespace-nowrap">
            {formatCurrency(unallocated)} unallocated
          </div>
        )}
      </div>

      <div
        className="relative h-10 w-full rounded-lg overflow-hidden flex bg-[var(--color-surface-alt)] border border-[color-mix(in_oklab,var(--color-fg),transparent_92%)]"
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
                  <div className="font-medium text-[var(--color-fg)]">{g.name}</div>
                  <div className="text-[var(--color-muted)] tabular-nums mt-0.5">
                    {formatCurrency(g.allocated)} of {formatCurrency(g.target)}
                    {" · "}
                    {(g.progress * 100).toFixed(0)}%
                  </div>
                </div>
              }
            >
              <button
                type="button"
                onMouseEnter={() => setHoveredId(g.id)}
                className="relative h-full transition-all duration-150 cursor-pointer flex items-center justify-center group"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: g.color,
                  opacity: hoveredId && !isHovered ? 0.55 : 1,
                  borderRight:
                    i < segments.length - 1
                      ? "1px solid color-mix(in oklab, white, transparent 80%)"
                      : "none",
                }}
                aria-label={`${g.name}: ${formatCurrency(g.allocated)} of ${formatCurrency(g.target)}`}
              >
                {g.isProtected && widthPct > 5 && (
                  <LuShield
                    className="text-white/80"
                    size={14}
                    aria-hidden
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
        {unallocated > 0 && (
          <Tooltip
            side="top"
            content={
              <div className="text-xs">
                <div className="font-medium text-[var(--color-fg)]">Unallocated</div>
                <div className="text-[var(--color-muted)] tabular-nums mt-0.5">
                  {formatCurrency(unallocated)} not yet assigned to a goal
                </div>
              </div>
            }
          >
            <button
              type="button"
              className="h-full flex-1 cursor-default"
              aria-label="Unallocated cash"
              style={{
                background:
                  "repeating-linear-gradient(45deg, color-mix(in oklab, var(--color-fg), transparent 90%), color-mix(in oklab, var(--color-fg), transparent 90%) 6px, transparent 6px, transparent 12px)",
              }}
            />
          </Tooltip>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-muted)] tabular-nums">
        <span>
          {hovered
            ? `${hovered.name} · ${formatCurrency(hovered.allocated)} / ${formatCurrency(hovered.target)}`
            : `${segments.length} ${segments.length === 1 ? "goal" : "goals"} funded`}
        </span>
        {segments.length < allocated.length && (
          <span>
            {allocated.length - segments.length} unfunded
          </span>
        )}
      </div>
    </div>
  );
}
