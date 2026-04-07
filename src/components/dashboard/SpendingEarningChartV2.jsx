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

// Fixed width per month group
const MONTH_GROUP_WIDTH = 80;

export default function SpendingEarningChartV2({ onSelectMonth, onHover, data = [] }) {
  const [activeMonthIndex, setActiveMonthIndex] = useState(null);
  const [tooltipInfo, setTooltipInfo] = useState(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(280);
  const [containerWidth, setContainerWidth] = useState(800);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Handle Resize
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

  // Update fade indicators based on scroll position
  const updateFadeIndicators = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    const canScroll = scrollWidth > clientWidth;
    setShowLeftFade(canScroll && scrollLeft > 10);
    setShowRightFade(canScroll && scrollLeft < scrollWidth - clientWidth - 10);
  };

  // Scroll to the right on mount to show most recent months
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

  // Process data — compute net cashflow per month
  const { months, netVals, incomeVals, spendingVals, maxAbs, ticks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { months: [], netVals: [], incomeVals: [], spendingVals: [], maxAbs: 0, ticks: [] };
    }

    const months = data.map(month => month.monthName.substring(0, 3));
    const incomeVals = data.map(month => month.earning || 0);
    const spendingVals = data.map(month => Math.abs(month.spending || 0));
    const netVals = data.map((month, i) => incomeVals[i] - spendingVals[i]);

    const rawMaxAbs = Math.max(1, ...netVals.map(Math.abs));

    // Generate symmetric ticks around zero
    const paddingFactor = 1.1;
    const adjusted = rawMaxAbs * paddingFactor;
    const targetTicks = 2; // ticks per side
    const roughStep = adjusted / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const norm = roughStep / magnitude;
    const niceStep = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    const stepValue = niceStep * magnitude;
    const maxTick = Math.ceil(rawMaxAbs / stepValue) * stepValue;

    const ticks = [];
    for (let v = -maxTick; v <= maxTick; v += stepValue) {
      ticks.push(v);
    }

    return { months, netVals, incomeVals, spendingVals, maxAbs: maxTick, ticks };
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

  // Single bar — wider than the old paired bars
  const barWidth = Math.min(28, stepX * 0.4);
  const barOffset = (stepX - barWidth) / 2;

  // Y scaling — symmetric around zero baseline
  const baseline = margin.top + innerHeight / 2;
  const halfHeight = innerHeight / 2;
  const scaleY = maxAbs > 0 ? halfHeight / maxAbs : 1;

  const yFromValue = (v) => baseline - v * scaleY;

  const onMove = (e, month, index) => {
    setActiveMonthIndex(index);

    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const cx = margin.left + stepX * index + stepX / 2;
      const tooltipLeft = cx - scrollLeft;

      setTooltipInfo({
        month,
        net: netVals[index],
        income: incomeVals[index],
        spending: spendingVals[index],
        left: tooltipLeft,
      });
    }

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
    setTooltipInfo(null);
    if (onHover) onHover(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Left fade gradient */}
      <div
        className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: showLeftFade ? 1 : 0,
          background: 'linear-gradient(to right, var(--color-surface), transparent)',
        }}
      />

      {/* Right fade gradient */}
      <div
        className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: showRightFade ? 1 : 0,
          background: 'linear-gradient(to left, var(--color-surface), transparent)',
        }}
      />

      {/* Tooltip */}
      {tooltipInfo && (
        <div
          className="absolute pointer-events-none tooltip-pop"
          style={{
            left: tooltipInfo.left,
            top: -8,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 1000,
          }}
        >
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap">
            <div className="font-medium mb-1.5 text-[var(--color-muted)] text-[10px] uppercase tracking-wide">
              {tooltipInfo.month}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--color-muted)]">Net</span>
                <span className={`font-medium ${tooltipInfo.net >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {tooltipInfo.net >= 0 ? '+' : ''}{formatCurrency(tooltipInfo.net)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--color-muted)]">Income</span>
                <span className="font-medium text-[var(--color-fg)]">{formatCurrency(tooltipInfo.income)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--color-muted)]">Spending</span>
                <span className="font-medium text-[var(--color-fg)]">{formatCurrency(tooltipInfo.spending)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-x-auto scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
        onScroll={() => {
          updateFadeIndicators();
          if (activeMonthIndex !== null && scrollContainerRef.current) {
            const scrollLeft = scrollContainerRef.current.scrollLeft;
            const cx = margin.left + stepX * activeMonthIndex + stepX / 2;
            const tooltipLeft = cx - scrollLeft;
            setTooltipInfo((prev) => (prev ? { ...prev, left: tooltipLeft } : null));
          }
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="h-full"
          style={{ minWidth: width }}
          onMouseLeave={onLeave}
        >
          <defs>
            <filter id="bar-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Vertical gradient for bar depth — lighter left, darker right */}
            <linearGradient id="bar-depth" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0.12" />
              <stop offset="50%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="black" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="bar-depth-dark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0.08" />
              <stop offset="50%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="black" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <g>
            {ticks.map((tick) => {
              const y = yFromValue(tick);
              return (
                <line
                  key={`tick-${tick}`}
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                  opacity={tick === 0 ? 0.6 : 0.3}
                />
              );
            })}
          </g>

          {/* Month labels */}
          <g>
            {months.map((m, i) => {
              const cx = margin.left + stepX * i + stepX / 2;
              return (
                <text
                  key={`lbl-${m}-${i}`}
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-muted)"
                  fontWeight="300"
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
              const barH = Math.max(2, Math.abs(net) * scaleY); // min 2px so zero months are visible
              const barY = isPositive ? baseline - barH : baseline;

              const barPath = isPositive
                ? roundedTopPath(barX, barY, barWidth, barH, 4)
                : roundedBottomPath(barX, barY, barWidth, barH, 4);

              const isActive = activeMonthIndex === i;

              return (
                <g
                  key={`bar-${m}-${i}`}
                  style={{
                    opacity: activeMonthIndex !== null && !isActive ? 0.4 : 1,
                    transition: 'all 0.3s ease',
                  }}
                >
                  <path
                    d={barPath}
                    fill="var(--color-chart-primary)"
                    opacity={isActive ? 1 : 0.3}
                    filter={isActive ? 'url(#bar-glow)' : undefined}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  {/* Depth overlay — highlight left, shadow right */}
                  <path
                    d={barPath}
                    fill="url(#bar-depth)"
                    className="dark:hidden"
                    opacity={isActive ? 1 : 0.6}
                    style={{ transition: 'opacity 0.3s ease', pointerEvents: 'none' }}
                  />
                  <path
                    d={barPath}
                    fill="url(#bar-depth-dark)"
                    className="hidden dark:block"
                    opacity={isActive ? 1 : 0.6}
                    style={{ transition: 'opacity 0.3s ease', pointerEvents: 'none' }}
                  />

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
