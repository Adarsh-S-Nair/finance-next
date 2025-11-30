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

function roundedRectPath(x, y, w, h, rTopLeft, rTopRight, rBottomRight, rBottomLeft) {
  const rTL = Math.max(0, Math.min(rTopLeft, Math.abs(w) / 2, Math.abs(h) / 2))
  const rTR = Math.max(0, Math.min(rTopRight, Math.abs(w) / 2, Math.abs(h) / 2))
  const rBR = Math.max(0, Math.min(rBottomRight, Math.abs(w) / 2, Math.abs(h) / 2))
  const rBL = Math.max(0, Math.min(rBottomLeft, Math.abs(w) / 2, Math.abs(h) / 2))

  const right = x + w
  const bottom = y + h

  return [
    `M ${x} ${y + rTL}`,
    `A ${rTL} ${rTL} 0 0 1 ${x + rTL} ${y}`,
    `L ${right - rTR} ${y}`,
    `A ${rTR} ${rTR} 0 0 1 ${right} ${y + rTR}`,
    `L ${right} ${bottom - rBR}`,
    `A ${rBR} ${rBR} 0 0 1 ${right - rBR} ${bottom}`,
    `L ${x + rBL} ${bottom}`,
    `A ${rBL} ${rBL} 0 0 1 ${x} ${bottom - rBL}`,
    'Z',
  ].join(' ')
}

export default function SpendingEarningChart({ onSelectMonth, onHover, data = [] }) {
  const { user } = useUser();
  const [activeMonth, setActiveMonth] = useState(null)
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
  const { months, incomeVals, spendingVals, maxIncome, maxSpending, totalRange, ticks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { months: [], incomeVals: [], spendingVals: [], maxIncome: 0, maxSpending: 0, totalRange: 1, ticks: [] }
    }

    const months = data.map(month => month.monthName.substring(0, 3))
    const incomeVals = data.map(month => month.earning || 0)
    const spendingVals = data.map(month => -(month.spending || 0))

    const maxIncome = Math.max(0, ...incomeVals)
    const maxSpending = Math.max(0, ...spendingVals.map(v => Math.abs(v)))
    const totalRange = Math.max(1, maxIncome + maxSpending)

    // Generate ticks
    const paddingFactor = 1.05
    const adjustedRange = totalRange * paddingFactor
    const targetTicks = 5
    const roughStep = adjustedRange / targetTicks
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const normalizedStep = roughStep / magnitude
    let niceStep = normalizedStep < 1.5 ? 1 : normalizedStep < 3 ? 2 : normalizedStep < 7 ? 5 : 10
    const stepValue = niceStep * magnitude

    const minVal = -maxSpending * paddingFactor
    const maxVal = maxIncome * paddingFactor
    const startTick = Math.ceil(minVal / stepValue) * stepValue
    const endTick = Math.floor(maxVal / stepValue) * stepValue

    const ticks = []
    for (let v = startTick; v <= endTick; v += stepValue) {
      ticks.push(v)  // Include all ticks including 0
    }

    return { months, incomeVals, spendingVals, maxIncome, maxSpending, totalRange, ticks }
  }, [data])

  // Dynamic dimensions
  const { width, height } = dimensions;
  const margin = { top: 10, right: 20, bottom: 30, left: 40 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const paddingFactor = 1.05
  const adjustedRange = totalRange * paddingFactor
  const zeroY = margin.top + (maxIncome / adjustedRange) * innerHeight + (innerHeight * (paddingFactor - 1) / 2)
  const scale = innerHeight / adjustedRange

  const step = months.length > 0 ? innerWidth / months.length : innerWidth
  const barWidth = Math.min(40, Math.max(8, step * 0.45))  // Cap at 40px max, thinner bars

  const yFromValue = (v) => v >= 0 ? zeroY - (v * scale) : zeroY
  const hFromValue = (v) => Math.max(1, Math.abs(v) * scale)

  const onMove = (e, month, inc, spd, fullData) => {
    setActiveMonth(month)
    if (onHover) {
      onHover({
        monthName: fullData.monthName,
        earning: inc,
        spending: Math.abs(spd)
      })
    }
  }

  const onLeave = () => {
    setActiveMonth(null)
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
        <defs>
          <linearGradient id="bar3D" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="black" stopOpacity="0.3" />
            <stop offset="15%" stopColor="black" stopOpacity="0.1" />
            <stop offset="40%" stopColor="white" stopOpacity="0.1" />
            <stop offset="85%" stopColor="black" stopOpacity="0.1" />
            <stop offset="100%" stopColor="black" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Grid Lines & Y-Axis */}
        <g>
          {ticks.map((tick) => {
            const y = yFromValue(tick)
            if (y < margin.top || y > height - margin.bottom) return null

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
                  opacity="0.8"
                />
                <text
                  x={margin.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--color-muted)"
                  fontWeight="300"
                >
                  {tick >= 1000 ? `${tick / 1000}k` : tick <= -1000 ? `-${Math.abs(tick) / 1000}k` : tick}
                </text>
              </g>
            )
          })}
        </g>

        {/* Month labels */}
        <g>
          {months.map((m, i) => {
            const cx = margin.left + step * i + step / 2
            return (
              <text key={`lbl-${m}-${i}`} x={cx} y={height - 15} textAnchor="middle" fontSize="10" fill="var(--color-muted)" fontWeight="300">
                {m}
              </text>
            )
          })}
        </g>

        {/* Bars */}
        <g>
          {months.map((m, i) => {
            const cx = margin.left + step * i + step / 2
            const x = cx - barWidth / 2
            const inc = incomeVals[i] || 0
            const spd = spendingVals[i] || 0
            const incH = hFromValue(inc)
            const spdH = hFromValue(spd)
            const incY = yFromValue(inc)
            const spdY = zeroY

            const isActive = activeMonth === m
            const filter = isActive ? 'brightness(1.1) drop-shadow(0 0 4px rgba(255,255,255,0.1))' : 'none'

            const incPath = roundedRectPath(x, incY, barWidth, incH, 12, 12, 0, 0)
            const spdPath = roundedRectPath(x, spdY, barWidth, spdH, 0, 0, 12, 12)

            return (
              <g
                key={`bar-${m}-${i}`}
                style={{
                  transition: 'transform 120ms ease, filter 120ms ease',
                  transform: isActive ? 'scale(1.02)' : 'scale(1.0)',
                  transformOrigin: `${cx}px ${zeroY}px`
                }}
              >
                {/* Income Bar */}
                <path d={incPath} fill="var(--color-chart-income)" filter={filter} />
                <path d={incPath} fill="url(#bar3D)" filter={filter} style={{ pointerEvents: 'none' }} />

                {/* Spending Bar */}
                <path d={spdPath} fill="var(--color-chart-expense)" filter={filter} />
                <path d={spdPath} fill="url(#bar3D)" filter={filter} style={{ pointerEvents: 'none' }} />

                <rect
                  x={x}
                  y={margin.top}
                  width={barWidth}
                  height={innerHeight}
                  fill="white"
                  opacity={0}
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
    </div>
  )
}
