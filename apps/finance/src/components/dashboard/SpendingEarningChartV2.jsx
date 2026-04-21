"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Rounded top corners (positive bars — grow upward)
function roundedTopPath(x, y, w, h, r) {
  const r2 = Math.min(r, w / 2, Math.abs(h) / 2);
  return `M ${x} ${y + h} L ${x} ${y + r2} Q ${x} ${y} ${x + r2} ${y} L ${x + w - r2} ${y} Q ${x + w} ${y} ${x + w} ${y + r2} L ${x + w} ${y + h} Z`;
}

// Rounded bottom corners (negative bars — grow downward)
function roundedBottomPath(x, y, w, h, r) {
  const r2 = Math.min(r, w / 2, Math.abs(h) / 2);
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - r2} Q ${x + w} ${y + h} ${x + w - r2} ${y + h} L ${x + r2} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r2} Z`;
}

const MONTH_GROUP_WIDTH = 80;

export default function SpendingEarningChartV2({ onSelectMonth, onHover, data = [] }) {
  const [activeMonthIndex, setActiveMonthIndex] = useState(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(280);
  const [containerWidth, setContainerWidth] = useState(800);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerHeight(height);
        setContainerWidth(width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const updateFadeIndicators = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const canScroll = scrollWidth > clientWidth;
    setShowLeftFade(canScroll && scrollLeft > 10);
    setShowRightFade(canScroll && scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    if (scrollContainerRef.current && data.length > 0) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
          updateFadeIndicators();
        }
      });
    }
  }, [data.length, containerWidth]);

  const { months, netVals, incomeVals, spendingVals, maxAbs } = useMemo(() => {
    if (!data || data.length === 0) {
      return { months: [], netVals: [], incomeVals: [], spendingVals: [], maxAbs: 0 };
    }

    const months = data.map(month => month.monthName.substring(0, 3));
    const incomeVals = data.map(month => month.earning || 0);
    const spendingVals = data.map(month => Math.abs(month.spending || 0));
    const netVals = data.map((month, i) => incomeVals[i] - spendingVals[i]);

    const rawMaxAbs = Math.max(1, ...netVals.map(Math.abs));
    const maxAbs = rawMaxAbs * 1.15; // 15% padding

    return { months, netVals, incomeVals, spendingVals, maxAbs };
  }, [data]);

  // Dimensions
  const height = containerHeight;
  const minChartWidth = months.length * MONTH_GROUP_WIDTH;
  const needsScroll = minChartWidth > containerWidth;
  const width = needsScroll ? minChartWidth : containerWidth;

  const isMobile = containerWidth < 400;
  const margin = { top: 8, right: 16, bottom: isMobile ? 22 : 30, left: 8 };
  const innerHeight = height - margin.top - margin.bottom;
  const stepX = MONTH_GROUP_WIDTH;

  const barWidth = Math.min(32, stepX * 0.45);
  const barOffset = (stepX - barWidth) / 2;

  // Y scaling — symmetric around zero baseline
  const baseline = margin.top + innerHeight / 2;
  const halfHeight = innerHeight / 2;
  const scaleY = maxAbs > 0 ? halfHeight / maxAbs : 1;

  const onMove = (e, month, index) => {
    setActiveMonthIndex(index);

    if (onHover) {
      onHover({
        monthName: data[index].monthName,
        earning: incomeVals[index],
        spending: spendingVals[index],
      });
    }
  };

  const onLeave = () => {
    setActiveMonthIndex(null);
    if (onHover) onHover(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Left fade */}
      <div
        className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: showLeftFade ? 1 : 0,
          background: 'linear-gradient(to right, var(--color-surface), transparent)',
        }}
      />

      {/* Right fade */}
      <div
        className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: showRightFade ? 1 : 0,
          background: 'linear-gradient(to left, var(--color-surface), transparent)',
        }}
      />

      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-x-auto scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
        onScroll={updateFadeIndicators}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="h-full"
          style={{ minWidth: width }}
          onMouseLeave={onLeave}
          onMouseMove={(e) => {
            // Clear hover when cursor is outside the data region
            const svgRect = e.currentTarget.getBoundingClientRect();
            const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
            const x = e.clientX - svgRect.left + scrollLeft;
            const dataEndX = margin.left + stepX * months.length;
            if (x > dataEndX || x < margin.left) {
              onLeave();
            }
          }}
        >
          {/* Zero baseline */}
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={baseline}
            y2={baseline}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {/* Month labels */}
          <g>
            {months.map((m, i) => {
              const cx = margin.left + stepX * i + stepX / 2;
              const isActive = activeMonthIndex === i;
              return (
                <text
                  key={`lbl-${m}-${i}`}
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isActive ? 'var(--color-fg)' : 'var(--color-muted)'}
                  fontWeight={isActive ? '500' : '400'}
                  style={{ transition: 'fill 0.2s ease' }}
                >
                  {m}
                </text>
              );
            })}
          </g>

          {/* Net cashflow bars */}
          <g>
            {months.map((m, i) => {
              const net = netVals[i];
              const barX = margin.left + stepX * i + barOffset;
              const isPositive = net >= 0;
              const barH = Math.max(2, Math.abs(net) * scaleY);
              const barY = isPositive ? baseline - barH : baseline;

              const barPath = isPositive
                ? roundedTopPath(barX, barY, barWidth, barH, 5)
                : roundedBottomPath(barX, barY, barWidth, barH, 5);

              const isActive = activeMonthIndex === i;
              const isDimmed = activeMonthIndex !== null && !isActive;

              // Color: positive = fg, negative = muted red
              const barColor = isPositive
                ? 'var(--color-fg)'
                : 'var(--color-danger)';

              return (
                <g
                  key={`bar-${m}-${i}`}
                  style={{
                    opacity: isDimmed ? 0.25 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <path
                    d={barPath}
                    fill={barColor}
                    opacity={isActive ? 1 : 0.7}
                    style={{ transition: 'opacity 0.2s ease' }}
                  />

                  {/* Value label — always rendered, animated via opacity + translate */}
                  <text
                    x={barX + barWidth / 2}
                    y={isPositive ? barY - 14 : barY + barH + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-fg)"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transform: `translateY(${isActive ? 0 : (isPositive ? 8 : -8)}px) scale(${isActive ? 1 : 0.85})`,
                      transformOrigin: `${barX + barWidth / 2}px ${isPositive ? barY - 14 : barY + barH + 20}px`,
                      transition: 'opacity 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.8, 0.64, 1)',
                    }}
                  >
                    {net >= 0 ? '+' : ''}{formatCurrency(net)}
                  </text>

                  {/* Invisible hover rect */}
                  <rect
                    x={margin.left + stepX * i}
                    y={margin.top}
                    width={stepX}
                    height={innerHeight}
                    fill="transparent"
                    onMouseMove={(e) => onMove(e, m, i)}
                    onMouseEnter={(e) => onMove(e, m, i)}
                    onClick={() => onSelectMonth && onSelectMonth(data[i])}
                    style={{ cursor: 'pointer' }}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
