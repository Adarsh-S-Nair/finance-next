"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useUser } from '../UserProvider';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function roundedRectPath(x, y, w, h, r) {
  const r2 = Math.min(r, w / 2, h / 2);
  return `M ${x} ${y + h} L ${x} ${y + r2} Q ${x} ${y} ${x + r2} ${y} L ${x + w - r2} ${y} Q ${x + w} ${y} ${x + w} ${y + r2} L ${x + w} ${y + h} Z`;
}

export default function SpendingEarningChartV2({ onSelectMonth, onHover, data = [] }) {
  const { user } = useUser();
  const [activeMonth, setActiveMonth] = useState(null)
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 280 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Process data
  const { months, incomeVals, spendingVals, maxValue, ticks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { months: [], incomeVals: [], spendingVals: [], maxValue: 0, ticks: [] }
    }

    const months = data.map(month => month.monthName.substring(0, 3))
    const incomeVals = data.map(month => month.earning || 0)
    const spendingVals = data.map(month => Math.abs(month.spending || 0)) // Treat spending as positive for side-by-side

    const maxIncome = Math.max(0, ...incomeVals)
    const maxSpending = Math.max(0, ...spendingVals)
    const rawMax = Math.max(maxIncome, maxSpending)

    // Generate ticks
    const paddingFactor = 1.1
    const adjustedMax = rawMax * paddingFactor
    const targetTicks = 5
    const roughStep = adjustedMax / targetTicks
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const normalizedStep = roughStep / magnitude
    let niceStep = normalizedStep < 1.5 ? 1 : normalizedStep < 3 ? 2 : normalizedStep < 7 ? 5 : 10
    const stepValue = niceStep * magnitude

    // Ensure we cover the max value
    const endTick = Math.ceil(adjustedMax / stepValue) * stepValue

    const ticks = []
    for (let v = 0; v <= endTick; v += stepValue) {
      ticks.push(v)
    }

    return { months, incomeVals, spendingVals, maxValue: endTick, ticks }
  }, [data])

  // Dynamic dimensions
  const { width, height } = dimensions;
  const margin = { top: 20, right: 20, bottom: 30, left: 10 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const scaleY = innerHeight / (maxValue || 1)
  const stepX = months.length > 0 ? innerWidth / months.length : innerWidth

  // Bar dimensions
  const groupPadding = stepX * 0.3 // Space between groups
  const barGap = stepX * 0.05 // Space between bars in a group
  const availableWidth = stepX - groupPadding
  const barWidth = (availableWidth - barGap) / 2
  const maxBarWidth = 24 // Cap max width
  const finalBarWidth = Math.min(barWidth, maxBarWidth)

  // Re-center if capped
  const totalGroupWidth = (finalBarWidth * 2) + barGap
  const offset = (stepX - totalGroupWidth) / 2

  const yFromValue = (v) => height - margin.bottom - (v * scaleY)
  const hFromValue = (v) => v * scaleY

  const onMove = (e, month, inc, spd, fullData) => {
    setActiveMonth(month)

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setTooltip({
        visible: true,
        x,
        y,
        data: { month, income: inc, spending: spd }
      });
    }

    if (onHover) {
      onHover({
        monthName: fullData.monthName,
        earning: inc,
        spending: spd
      })
    }
  }

  const onLeave = () => {
    setActiveMonth(null)
    setTooltip(prev => ({ ...prev, visible: false }));
    if (onHover) {
      onHover(null)
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        onMouseLeave={onLeave}
      >
        {/* Grid Lines & Y-Axis */}
        <g>
          {ticks.map((tick) => {
            const y = yFromValue(tick)
            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />
              </g>
            )
          })}
        </g>

        {/* Month labels */}
        <g>
          {months.map((m, i) => {
            const cx = margin.left + stepX * i + stepX / 2
            return (
              <text key={`lbl-${m}-${i}`} x={cx} y={height - 10} textAnchor="middle" fontSize="10" fill="var(--color-muted)" fontWeight="300">
                {m}
              </text>
            )
          })}
        </g>

        {/* Bars */}
        <g>
          {months.map((m, i) => {
            const groupX = margin.left + stepX * i + offset

            const inc = incomeVals[i] || 0
            const spd = spendingVals[i] || 0

            const incH = hFromValue(inc)
            const spdH = hFromValue(spd)

            const incY = yFromValue(inc)
            const spdY = yFromValue(spd)

            const isActive = activeMonth === m

            // Income Bar (Left)
            const incBarPath = roundedRectPath(groupX, incY, finalBarWidth, incH, 4)

            // Spending Bar (Right)
            const spdBarPath = roundedRectPath(groupX + finalBarWidth + barGap, spdY, finalBarWidth, spdH, 4)

            return (
              <g
                key={`bar-${m}-${i}`}
                style={{
                  opacity: activeMonth && !isActive ? 0.4 : 1,
                  transition: 'opacity 0.2s ease'
                }}
              >
                <path
                  d={incBarPath}
                  fill="var(--color-accent)"
                />
                <path
                  d={spdBarPath}
                  fill="var(--color-chart-spending-bar)"
                />

                {/* Invisible hover rect for the whole group */}
                <rect
                  x={margin.left + stepX * i}
                  y={margin.top}
                  width={stepX}
                  height={innerHeight}
                  fill="transparent"
                  onMouseMove={(e) => onMove(e, m, inc, spd, data[i])}
                  onMouseEnter={(e) => onMove(e, m, inc, spd, data[i])}
                  onClick={() => onSelectMonth && onSelectMonth(data[i])}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div
          style={{ left: tooltip.x, top: tooltip.y }}
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] transition-all duration-75 ease-out"
        >
          <div className="bg-[var(--color-surface)]/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-[var(--color-border)] text-xs min-w-[140px]">
            <div className="font-medium mb-2 text-[var(--color-muted)] border-b border-[var(--color-border)] pb-1">
              {tooltip.data.month}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                  <span className="text-[var(--color-muted)]">Income</span>
                </div>
                <span className="font-semibold text-[var(--color-fg)]">{formatCurrency(tooltip.data.income)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-chart-spending-bar)]" />
                  <span className="text-[var(--color-muted)]">Spending</span>
                </div>
                <span className="font-semibold text-[var(--color-fg)]">{formatCurrency(tooltip.data.spending)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
