import React from 'react';
import { TOOLTIP_SURFACE_CLASSES } from '@zervo/ui';

export default function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    // Handle different data structures (NetWorth vs Spending)
    const value = data.value !== undefined ? data.value : data.total_spent;
    const title = data.label || data.monthFull || label;

    const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(val);
    };

    const color = data.color || data.fill || data.hex_color || 'var(--color-accent)';

    return (
      <div className={`${TOOLTIP_SURFACE_CLASSES} p-3 text-xs min-w-[140px]`}>
        <div className="font-medium mb-2 text-[var(--color-floating-fg)]">
          {title}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[var(--color-floating-muted)]">Total</span>
            </div>
            <span className="font-semibold text-[var(--color-floating-fg)]">
              {formatCurrency(value)}
            </span>
          </div>
          {data.percentage !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full opacity-0" />
                <span className="text-[var(--color-floating-muted)]">Share</span>
              </div>
              <span className="font-semibold text-[var(--color-floating-fg)]">
                {data.percentage.toFixed(1)}%
              </span>
            </div>
          )}
          {data.subLabel && (
            <div className="text-[var(--color-floating-muted)] pl-3">
              {data.subLabel}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
