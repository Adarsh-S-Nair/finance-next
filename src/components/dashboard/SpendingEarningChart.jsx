"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function roundedRectPath(x, y, w, h, rTopLeft, rTopRight, rBottomRight, rBottomLeft) {
  // Safeguards
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

export default function SpendingEarningChart({ series, title = 'Spending vs Earnings', height = 300, onSelectMonth }) {
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)
  const rafRef = useRef(null)

  const [dims, setDims] = useState({ width: 600, height: 200 })
  const [activeMonth, setActiveMonth] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, month: '', income: 0, spending: 0 })

  // Observe container width and height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width))
        const h = Math.max(200, Math.floor(entry.contentRect.height))
        setDims((d) => ({ ...d, width: w, height: h }))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Remove height override - let container determine height

  // Normalize data
  const { months, incomeVals, spendingVals, maxAbs } = useMemo(() => {
    const defaultSeries = [
      { id: 'Income', data: [ { x: 'Jan', y: 4200 }, { x: 'Feb', y: 3800 }, { x: 'Mar', y: 4500 }, { x: 'Apr', y: 4100 }, { x: 'May', y: 4800 }, { x: 'Jun', y: 5200 } ] },
      { id: 'Spending', data: [ { x: 'Jan', y: -3200 }, { x: 'Feb', y: -2900 }, { x: 'Mar', y: -3500 }, { x: 'Apr', y: -3100 }, { x: 'May', y: -3800 }, { x: 'Jun', y: -4200 } ] },
    ]
    const incomeSeries = (series || defaultSeries).find((s) => s.id.toLowerCase() === 'income') || defaultSeries[0]
    const spendingSeries = (series || defaultSeries).find((s) => s.id.toLowerCase() === 'spending') || defaultSeries[1]

    // Ensure spending negative
    const income = incomeSeries.data.map((d) => ({ x: String(d.x), y: Number(d.y) || 0 }))
    const spending = spendingSeries.data.map((d) => ({ x: String(d.x), y: -Math.abs(Number(d.y) || 0) }))

    const m = income.map((d) => d.x)

    // Trim leading months where both are zero
    let start = 0
    for (let i = 0; i < m.length; i++) {
      if ((income[i]?.y || 0) !== 0 || (spending[i]?.y || 0) !== 0) {
        start = i
        break
      }
    }
    const months = m.slice(start)
    const incomeVals = income.slice(start).map((d) => d.y)
    const spendingVals = spending.slice(start).map((d) => d.y)
    const maxAbs = Math.max(1, ...incomeVals.map((v) => Math.abs(v)), ...spendingVals.map((v) => Math.abs(v)))
    return { months, incomeVals, spendingVals, maxAbs }
  }, [series])

  // Layout
  const margin = { top: 5, right: 10, bottom: 15, left: 10 }
  const innerWidth = Math.max(0, dims.width - margin.left - margin.right)
  const innerHeight = Math.max(0, dims.height - margin.top - margin.bottom)
  const zeroY = margin.top + innerHeight / 2

  const step = months.length > 0 ? innerWidth / months.length : innerWidth
  const barWidth = Math.max(10, step * 0.32)

  const yFromValue = (v) => zeroY - (v / maxAbs) * (innerHeight / 2)
  const hFromValue = (v) => Math.max(1, Math.abs((v / maxAbs) * (innerHeight / 2)))

  const formatDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const onMove = (e, month, inc, spd) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const next = {
      visible: true,
      x: (e.clientX - (rect?.left || 0)) + 12,
      y: (e.clientY - (rect?.top || 0)) - 12,
      month,
      income: inc,
      spending: Math.abs(spd),
    }
    setActiveMonth(month)
    if (tooltipRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        tooltipRef.current.style.left = `${next.x}px`
        tooltipRef.current.style.top = `${next.y}px`
      })
    }
    setTooltip((prev) => {
      const sameContent = prev.month === next.month && prev.income === next.income && prev.spending === next.spending
      if (sameContent) {
        // If previously hidden, re-show and update position
        if (!prev.visible) return { ...prev, visible: true, x: next.x, y: next.y }
        return prev
      }
      return next
    })
  }

  const onLeave = () => {
    setActiveMonth(null)
    setTooltip((p) => ({ ...p, visible: false }))
  }

  const handleMonthClick = (index, label) => {
    if (!onSelectMonth) return
    const now = new Date()
    const monthsBack = months.length - 1 - index
    const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0)
    onSelectMonth({ month: label, startDate: formatDate(start), endDate: formatDate(end) })
  }

  return (
    <div ref={containerRef} className="w-full" style={{ height: `${dims.height}px`, position: 'relative' }}>
      {/* Tooltip */}
      {tooltip.visible && (
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-fg)', marginBottom: 8 }}>
            {tooltip.month}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Income:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)' }}>
              {formatCurrency(tooltip.income)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Spending:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-fg)' }}>
              {formatCurrency(tooltip.spending)}
            </span>
          </div>
        </div>
      )}

      <svg width={dims.width} height={dims.height} style={{ overflow: 'visible' }} onMouseLeave={onLeave}>
        {/* Gradients */}
        <defs>
          <linearGradient id="brandBarSolid" x1="0" y1={margin.top} x2="0" y2={margin.top + innerHeight} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={'var(--color-accent)'} stopOpacity="1" />
            <stop offset="100%" stopColor={'var(--color-accent)'} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="brandBarLight" x1="0" y1={margin.top} x2="0" y2={margin.top + innerHeight} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={'var(--color-accent)'} stopOpacity="0.6" />
            <stop offset="100%" stopColor={'var(--color-accent)'} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Zero line */}
        <g>
          <line x1={margin.left} x2={dims.width - margin.right} y1={zeroY} y2={zeroY} stroke="var(--color-border)" strokeWidth="1" />
        </g>

        {/* Month labels */}
        <g>
          {months.map((m, i) => {
            const cx = margin.left + step * i + step / 2
            return (
              <text key={`lbl-${m}-${i}`} x={cx} y={dims.height - 5} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
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
            const spd = spendingVals[i] || 0 // negative
            const incH = hFromValue(inc)
            const spdH = hFromValue(spd)
            const incY = yFromValue(inc)
            const spdY = zeroY

            const isActive = activeMonth === m
            const groupStyle = {
              transition: 'transform 120ms ease, filter 120ms ease',
              transform: isActive ? 'scale(1.02)' : 'scale(1.0)',
              transformOrigin: `${cx}px ${zeroY}px`
            }
            const filter = isActive ? 'brightness(1.06) drop-shadow(0 2px 6px rgba(0,0,0,0.10))' : 'none'

            const incPath = roundedRectPath(x, incY, barWidth, incH, 10, 10, 0, 0)
            const spdPath = roundedRectPath(x, spdY, barWidth, spdH, 0, 0, 10, 10)

            return (
              <g key={`bar-${m}-${i}`} style={groupStyle}>
                {/* Income */}
                <path d={incPath} fill="url(#brandBarSolid)" filter={filter} />
                {/* Spending */}
                <path d={spdPath} fill="url(#brandBarLight)" filter={filter} />
                {/* Hover overlay for unified tooltip */}
                <rect
                  x={x}
                  y={margin.top}
                  width={barWidth}
                  height={innerHeight}
                  fill="transparent"
                  onMouseMove={(e) => onMove(e, m, inc, spd)}
                  onMouseEnter={(e) => onMove(e, m, inc, spd)}
                  onMouseLeave={onLeave}
                  onClick={() => handleMonthClick(i, m)}
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
