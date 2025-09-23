"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const { user } = useUser();
  const containerRef = useRef(null)
  const tooltipRef = useRef(null)
  const rafRef = useRef(null)

  const [dims, setDims] = useState({ width: 600, height: 200 })
  const [activeMonth, setActiveMonth] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, month: '', income: 0, spending: 0 })
  const [monthlyData, setMonthlyData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch monthly spending and earning data
  useEffect(() => {
    const fetchSpendingEarningData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/transactions/spending-earning?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch spending/earning data');
        }
        
        const result = await response.json();
        setMonthlyData(result.data || []);
        
      } catch (err) {
        console.error('Error fetching spending/earning data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSpendingEarningData();
  }, [user?.id]);

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

  // Normalize data from API
  const { months, incomeVals, spendingVals, maxAbs } = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) {
      return { months: [], incomeVals: [], spendingVals: [], maxAbs: 1 }
    }

    // Convert API data to chart format
    const months = monthlyData.map(month => month.monthName.substring(0, 3)) // Jan, Feb, etc.
    const incomeVals = monthlyData.map(month => month.earning || 0)
    const spendingVals = monthlyData.map(month => -(month.spending || 0)) // Make negative for chart

    // Calculate max absolute value for scaling
    const maxAbs = Math.max(1, ...incomeVals.map((v) => Math.abs(v)), ...spendingVals.map((v) => Math.abs(v)))
    
    return { months, incomeVals, spendingVals, maxAbs }
  }, [monthlyData])

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
    if (!rect) return

    // Get actual tooltip dimensions if available, otherwise use estimates
    let tooltipWidth = 200
    let tooltipHeight = 80
    if (tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      tooltipWidth = tooltipRect.width
      tooltipHeight = tooltipRect.height
    }
    
    // Calculate cursor position relative to container
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    
    // Calculate initial position preferences (right and above cursor)
    const offset = 12
    let finalX = cursorX + offset
    let finalY = cursorY - offset

    // Smart horizontal positioning
    // Check if tooltip would overflow right edge of container
    if (finalX + tooltipWidth > rect.width) {
      // Try positioning left of cursor
      finalX = cursorX - tooltipWidth - offset
      // If still overflowing left edge, position at edge with padding
      if (finalX < 0) {
        finalX = 5
      }
    }

    // Smart vertical positioning
    // Check if tooltip would overflow top edge of container
    if (finalY < 0) {
      // Position below cursor
      finalY = cursorY + offset
      // If still overflowing bottom edge, position at bottom with padding
      if (finalY + tooltipHeight > rect.height) {
        finalY = rect.height - tooltipHeight - 5
      }
    } else if (finalY + tooltipHeight > rect.height) {
      // If tooltip overflows bottom edge, try above cursor
      finalY = cursorY - tooltipHeight - offset
      // If still overflowing top, position at top with padding
      if (finalY < 0) {
        finalY = 5
      }
    }

    // Final safety checks to ensure tooltip stays within bounds
    finalX = Math.max(5, Math.min(finalX, rect.width - tooltipWidth - 5))
    finalY = Math.max(5, Math.min(finalY, rect.height - tooltipHeight - 5))

    const next = {
      visible: true,
      x: finalX,
      y: finalY,
      month,
      income: inc,
      spending: Math.abs(spd),
    }
    
    setActiveMonth(month)
    if (tooltipRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${finalX}px`
          tooltipRef.current.style.top = `${finalY}px`
        }
      })
    }
    setTooltip((prev) => {
      const sameContent = prev.month === next.month && prev.income === next.income && prev.spending === next.spending
      if (sameContent) {
        // If previously hidden, re-show and update position
        if (!prev.visible) return { ...prev, visible: true, x: finalX, y: finalY }
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

  // Show loading state
  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: `${dims.height}px` }}>
        <div className="text-[var(--color-muted)]">Loading spending data...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: `${dims.height}px` }}>
        <div className="text-[var(--color-muted)] text-center">
          <div>Unable to load spending data</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!monthlyData || monthlyData.length === 0) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: `${dims.height}px` }}>
        <div className="text-[var(--color-muted)] text-center">
          <div>No spending data available</div>
          <div className="text-sm mt-1">Connect accounts to see your spending patterns</div>
        </div>
      </div>
    );
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