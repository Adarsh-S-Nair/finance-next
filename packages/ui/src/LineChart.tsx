"use client";

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from 'recharts';

interface DataPoint {
  [key: string]: any;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  dataKey?: string;
  width?: number | string;
  height?: number | string;
  margin?: { top: number; right: number; bottom: number; left: number };
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillColor?: string;
  showDots?: boolean;
  dotColor?: string;
  dotRadius?: number;
  showArea?: boolean;
  areaOpacity?: number;
  onMouseMove?: (data: any, index: number) => void;
  onMouseLeave?: () => void;
  className?: string;
  style?: React.CSSProperties;
  gradientId?: string;
  showGrid?: boolean;
  gridColor?: string;
  showXAxis?: boolean;
  showYAxis?: boolean;
  xAxisDataKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  tooltip?: (data: any, index: number) => React.ReactNode;
  showTooltip?: boolean;
  animationDuration?: number;
  curveType?: 'linear' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter' | 'basis';
  lines?: {
    dataKey: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    strokeDasharray?: string;
    fillColor?: string;
    gradientId?: string;
    showArea?: boolean;
    areaOpacity?: number;
    /** Show a soft glow at the last non-null data point */
    endpointGlow?: boolean;
    /** Fade stroke opacity from near-zero on the left to full on the right */
    fadeIn?: boolean;
  }[];
  yAxisDomain?: [number | string, number | string];
  xAxisInterval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd';
}

export default function LineChart({
  data = [],
  dataKey = 'value',
  width = '100%',
  height = 200,
  margin = { top: 10, right: 10, bottom: 10, left: 10 },
  strokeColor = 'var(--color-accent)',
  strokeWidth = 2,
  strokeOpacity = 0.8,
  fillColor,
  showDots = false,
  dotColor,
  dotRadius = 4,
  showArea = true,
  areaOpacity = 0.2,
  onMouseMove,
  onMouseLeave,
  className = '',
  style = {},
  gradientId = 'lineChartGradient',
  showGrid = false,
  gridColor = 'var(--color-border)',
  showXAxis = false,
  showYAxis = false,
  xAxisDataKey = 'name',
  xAxisLabel,
  yAxisLabel,
  formatXAxis,
  formatYAxis,
  tooltip,
  showTooltip = false,
  animationDuration = 800,
  curveType = 'monotone',
  lines,
  yAxisDomain,
  xAxisInterval,
}: LineChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  // Per-touch gesture state. We track the starting point and whether
  // the gesture has resolved into a horizontal scrub so we can bail out
  // cleanly when the user is actually trying to scroll the page
  // vertically. Kept in a ref so updates don't re-render.
  const touchStateRef = React.useRef<{
    startX: number;
    startY: number;
    scrubbing: boolean;
    abandoned: boolean;
  } | null>(null);

  // Normalize lines configuration
  const chartLines = React.useMemo(() => {
    if (lines && lines.length > 0) {
      return lines.map((line, index) => ({
        dataKey: line.dataKey,
        strokeColor: line.strokeColor || strokeColor,
        strokeWidth: line.strokeWidth || strokeWidth,
        strokeOpacity: line.strokeOpacity || strokeOpacity,
        strokeDasharray: line.strokeDasharray,
        gradientId: line.gradientId || `${gradientId}-${index}`,
        showArea: line.showArea !== undefined ? line.showArea : showArea,
        areaOpacity: line.areaOpacity !== undefined ? line.areaOpacity : areaOpacity,
        endpointGlow: line.endpointGlow || false,
        fadeIn: line.fadeIn || false,
      }));
    }
    return [{
      dataKey,
      strokeColor,
      strokeWidth,
      strokeOpacity,
      strokeDasharray: undefined,
      gradientId,
      showArea,
      areaOpacity,
      endpointGlow: false,
      fadeIn: false,
    }];
  }, [lines, dataKey, strokeColor, strokeWidth, strokeOpacity, gradientId, showArea, areaOpacity]);

  // Shared index calculation used by both pointer and touch paths.
  const indexFromClientX = (clientX: number): number | null => {
    if (!containerRef.current || !data.length) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const chartWidth = rect.width;

    // Account for margins in the calculation
    // The actual chart area is smaller than the container due to margins
    const effectiveLeft = typeof margin.left === 'number' ? margin.left : 0;
    const effectiveRight = chartWidth - (typeof margin.right === 'number' ? margin.right : 0);
    const effectiveWidth = Math.max(1, effectiveRight - effectiveLeft);
    const relativeX = Math.max(0, Math.min(effectiveWidth, x - effectiveLeft));

    if (data.length === 1) return 0;
    if (data.length === 2) {
      const midpoint = effectiveWidth / 2;
      return relativeX < midpoint ? 0 : 1;
    }

    const normalizedX = relativeX / effectiveWidth;
    const rawIndex = normalizedX * (data.length - 1);
    return Math.min(Math.max(0, Math.round(rawIndex)), data.length - 1);
  };

  const setActiveFromClientX = (clientX: number) => {
    const index = indexFromClientX(clientX);
    if (index === null) return;
    setActiveIndex(index);
    onMouseMove?.(data[index], index);
  };

  // Handle Mouse Move on Overlay
  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setActiveFromClientX(e.clientX);
  };

  // Handle Mouse Leave on Overlay
  const handleOverlayMouseLeave = () => {
    setActiveIndex(null);
    if (onMouseLeave) {
      onMouseLeave();
    }
  };

  // Touch scrubbing. On mobile/tablet, pressing and dragging across the
  // chart acts like a desktop hover — the scrubber follows the finger.
  // We start tracking on touchstart but don't commit to "scrubbing" until
  // the gesture is clearly horizontal (or the user has held still for a
  // few frames) so vertical scrolls still pass through to the page.
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStateRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      scrubbing: false,
      abandoned: false,
    };
    setActiveFromClientX(t.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = touchStateRef.current;
    if (!state || state.abandoned) return;
    const t = e.touches[0];
    if (!t) return;

    if (!state.scrubbing) {
      const dx = Math.abs(t.clientX - state.startX);
      const dy = Math.abs(t.clientY - state.startY);
      // If the gesture is clearly vertical, bail and let the page
      // scroll. Clear the scrubber so a vertical swipe doesn't leave a
      // stale dot behind on the chart.
      if (dy > dx && dy > 8) {
        state.abandoned = true;
        setActiveIndex(null);
        onMouseLeave?.();
        return;
      }
      if (dx > 4 || dy > 4) state.scrubbing = true;
    }

    setActiveFromClientX(t.clientX);
  };

  const handleTouchEnd = () => {
    touchStateRef.current = null;
    setActiveIndex(null);
    onMouseLeave?.();
  };

  // Global mouse move listener to handle fast exits
  React.useEffect(() => {
    if (activeIndex === null) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const isOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;

      if (isOutside) {
        handleOverlayMouseLeave();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [activeIndex]);

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width, height, ...style }}
      >
        <div className="text-sm text-[var(--color-muted)]">No data available</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width, height, ...style }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={margin}
        >
          <defs>
            {chartLines.map((line) => (
              <React.Fragment key={line.gradientId}>
                <linearGradient id={line.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={line.strokeColor} stopOpacity={line.areaOpacity} />
                  <stop offset="25%" stopColor={line.strokeColor} stopOpacity={line.areaOpacity * 0.65} />
                  <stop offset="60%" stopColor={line.strokeColor} stopOpacity={line.areaOpacity * 0.2} />
                  <stop offset="100%" stopColor={line.strokeColor} stopOpacity={0} />
                </linearGradient>
                {line.fadeIn && (
                  <linearGradient id={`${line.gradientId}-fadeIn`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={line.strokeColor} stopOpacity={0.05} />
                    <stop offset="40%" stopColor={line.strokeColor} stopOpacity={0.35} />
                    <stop offset="75%" stopColor={line.strokeColor} stopOpacity={0.75} />
                    <stop offset="100%" stopColor={line.strokeColor} stopOpacity={1} />
                  </linearGradient>
                )}
                {line.endpointGlow && (
                  <filter id={`${line.gradientId}-glow`} x="-200%" y="-200%" width="500%" height="500%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                )}
              </React.Fragment>
            ))}
          </defs>

          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
              opacity={0.3}
            />
          )}

          {/* Always render XAxis to support ReferenceLine, even if hidden */}
          <XAxis
            dataKey={xAxisDataKey}
            hide={!showXAxis}
            tickFormatter={formatXAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
            interval={xAxisInterval}
            padding={{ left: 8, right: 8 }}
          />

          {/* Always render YAxis to support domain scaling, hide if not needed */}
          <YAxis
            hide={!showYAxis}
            domain={yAxisDomain}
            tickFormatter={formatYAxis}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
            width={40}
          />

          {showTooltip && (
            <Tooltip
              content={<CustomTooltip tooltip={tooltip} data={data} />}
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
          )}

          {chartLines.map((line) => (
            <Area
              key={line.dataKey}
              type={curveType}
              dataKey={line.dataKey}
              stroke={line.fadeIn ? `url(#${line.gradientId}-fadeIn)` : line.strokeColor}
              strokeWidth={line.strokeWidth}
              strokeOpacity={line.fadeIn ? 1 : line.strokeOpacity}
              strokeDasharray={line.strokeDasharray}
              fill={line.showArea ? `url(#${line.gradientId})` : 'none'}
              baseValue="dataMin"
              isAnimationActive={false}
              activeDot={false} // We handle active dot manually
              connectNulls={false} // Stop rendering line at null values
              dot={showDots ? {
                r: dotRadius,
                fill: dotColor || line.strokeColor,
                strokeWidth: 0
              } : false}
            />
          ))}

          {/* Glowing endpoint dot — always visible on the last data point */}
          {chartLines.map((line) => {
            if (!line.endpointGlow) return null;
            // Find last non-null data point
            let lastIdx = data.length - 1;
            while (lastIdx >= 0 && (data[lastIdx][line.dataKey] == null)) lastIdx--;
            if (lastIdx < 0) return null;
            return (
              <ReferenceDot
                key={`glow-${line.dataKey}`}
                x={data[lastIdx][xAxisDataKey]}
                y={data[lastIdx][line.dataKey]}
                r={3.5}
                fill={line.strokeColor}
                stroke={line.strokeColor}
                strokeWidth={0}
                filter={`url(#${line.gradientId}-glow)`}
              />
            );
          })}

          {/* Manual Active Visuals */}
          {activeIndex !== null && data[activeIndex] && (
            <>
              <ReferenceLine
                x={data[activeIndex][xAxisDataKey]}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              {chartLines.map((line) => (
                <ReferenceDot
                  key={line.dataKey}
                  x={data[activeIndex][xAxisDataKey]}
                  y={data[activeIndex][line.dataKey]}
                  r={dotRadius + 2}
                  fill={dotColor || line.strokeColor}
                  stroke="var(--color-bg)"
                  strokeWidth={2}
                />
              ))}
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Invisible overlay to capture mouse and touch events. We set
          touch-action: pan-y so vertical page scrolls still work — the
          browser reserves vertical pans for itself and hands horizontal
          motion to our scrub handlers. */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: 'auto', cursor: 'default', touchAction: 'pan-y' }}
        onMouseMove={handleOverlayMouseMove}
        onMouseLeave={handleOverlayMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

    </div>
  );
}

// Helper for Tooltip
const CustomTooltip = ({ active, payload, tooltip, data }: any) => {
  if (active && payload && payload.length && tooltip) {
    const dataPoint = payload[0].payload;
    const index = data.indexOf(dataPoint);
    return tooltip(dataPoint, index);
  }
  return null;
};
