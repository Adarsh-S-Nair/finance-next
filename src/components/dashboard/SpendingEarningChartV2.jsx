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

function TooltipContent({ month, income, spending, position, containerSize, monthIndex, totalMonths }) {
  const { left, top } = position;
  const { width, height } = containerSize;

  // Calculate percentage position
  let leftPercent = (left / width) * 100;

  // Clamp tooltip position to prevent edge clipping
  // For first few months, shift right; for last few months, shift left
  const tooltipHalfWidth = 8; // ~80px tooltip / 2, as percentage of typical container
  if (monthIndex === 0) {
    leftPercent = Math.max(leftPercent, tooltipHalfWidth);
  } else if (monthIndex === totalMonths - 1) {
    leftPercent = Math.min(leftPercent, 100 - tooltipHalfWidth);
  }

  return (
    <div
      className="absolute z-50 pointer-events-none tooltip-pop"
      style={{
        left: `${leftPercent}%`,
        top: `${(top / height) * 100}%`,
      }}
    >
      <div className="bg-[var(--color-surface)]/98 backdrop-blur-md px-3 py-2 rounded-lg border border-[var(--color-border)]/50 text-xs shadow-sm whitespace-nowrap">
        <div className="font-medium mb-1.5 text-[var(--color-muted)] text-[10px] uppercase tracking-wide">
          {month}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--color-muted)]">Income</span>
            <span className="font-medium text-[var(--color-fg)]">{formatCurrency(income)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[var(--color-muted)]">Spending</span>
            <span className="font-medium text-[var(--color-fg)]">{formatCurrency(spending)}</span>
          </div>
        </div>
        <div className="mt-2 pt-1.5 border-t border-[var(--color-border)]/30 text-[10px] text-[var(--color-accent)] text-center">
          Click to view transactions
        </div>
      </div>
    </div>
  );
}

export default function SpendingEarningChartV2({ onSelectMonth, onHover, data = [] }) {
  const { user } = useUser();
  const [activeMonthIndex, setActiveMonthIndex] = useState(null)
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 280 });

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
  // Reduce bottom margin on smaller screens
  const isMobile = width < 400;
  const margin = { top: 16, right: 16, bottom: isMobile ? 22 : 30, left: 8 }
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

  const onMove = (e, month, inc, spd, fullData, index) => {
    setActiveMonthIndex(index)

    if (onHover) {
      onHover({
        monthName: fullData.monthName,
        earning: inc,
        spending: spd
      })
    }
  }

  const onLeave = () => {
    setActiveMonthIndex(null)
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

            const isActive = activeMonthIndex === i

            // Income Bar (Left)
            const incBarPath = roundedRectPath(groupX, incY, finalBarWidth, incH, 4)

            // Spending Bar (Right)
            const spdBarPath = roundedRectPath(groupX + finalBarWidth + barGap, spdY, finalBarWidth, spdH, 4)

            return (
              <g
                key={`bar-${m}-${i}`}
                style={{
                  opacity: activeMonthIndex !== null && !isActive ? 0.4 : 1,
                  transition: 'opacity 0.2s ease'
                }}
              >
                <path
                  d={incBarPath}
                  fill="var(--color-cashflow-income)"
                />
                <path
                  d={spdBarPath}
                  fill="var(--color-cashflow-spending)"
                />

                {/* Invisible hover rect for the whole group */}
                <rect
                  x={margin.left + stepX * i}
                  y={margin.top}
                  width={stepX}
                  height={innerHeight}
                  fill="transparent"
                  onMouseMove={(e) => onMove(e, m, inc, spd, data[i], i)}
                  onMouseEnter={(e) => onMove(e, m, inc, spd, data[i], i)}
                  onClick={() => onSelectMonth && onSelectMonth(data[i])}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {activeMonthIndex !== null && months[activeMonthIndex] && (() => {
        // Calculate the position of the tallest bar for this month
        const inc = incomeVals[activeMonthIndex] || 0
        const spd = spendingVals[activeMonthIndex] || 0

        const incY = yFromValue(inc)
        const spdY = yFromValue(spd)

        // The tallest bar has the smallest Y value (top of bar)
        const tallestBarTop = Math.min(incY, spdY)

        // Position tooltip just above the tallest bar (with 8px gap)
        const tooltipY = tallestBarTop - 8

        return (
          <TooltipContent
            key={activeMonthIndex}
            month={months[activeMonthIndex]}
            income={inc}
            spending={spd}
            position={{
              left: margin.left + stepX * activeMonthIndex + stepX / 2,
              top: tooltipY
            }}
            containerSize={{ width, height }}
            monthIndex={activeMonthIndex}
            totalMonths={months.length}
          />
        );
      })()}
    </div>
  )
}
