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
}: LineChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  // Handle Mouse Move on Overlay
  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !data.length) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartWidth = rect.width;

    // Calculate index based on x position
    // Assuming data points are evenly distributed
    const index = Math.min(
      Math.max(0, Math.round((x / chartWidth) * (data.length - 1))),
      data.length - 1
    );

    setActiveIndex(index);

    if (onMouseMove) {
      onMouseMove(data[index], index);
    }
  };

  // Handle Mouse Leave on Overlay
  const handleOverlayMouseLeave = () => {
    setActiveIndex(null);
    if (onMouseLeave) {
      onMouseLeave();
    }
  };

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
      onMouseMove={handleOverlayMouseMove}
      onMouseLeave={handleOverlayMouseLeave}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={margin}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={areaOpacity} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
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
          />

          {showYAxis && (
            <YAxis
              tickFormatter={formatYAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              width={40}
            />
          )}

          {showTooltip && (
            <Tooltip
              content={<CustomTooltip tooltip={tooltip} data={data} />}
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
          )}

          <Area
            type={curveType}
            dataKey={dataKey}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
            fill={showArea ? `url(#${gradientId})` : 'none'}
            animationDuration={animationDuration}
            activeDot={false} // We handle active dot manually
            dot={showDots ? {
              r: dotRadius,
              fill: dotColor || strokeColor,
              strokeWidth: 0
            } : false}
          />

          {/* Manual Active Visuals */}
          {activeIndex !== null && (
            <>
              <ReferenceLine
                x={data[activeIndex][xAxisDataKey]}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <ReferenceDot
                x={data[activeIndex][xAxisDataKey]}
                y={data[activeIndex][dataKey]}
                r={dotRadius + 2}
                fill={dotColor || strokeColor}
                stroke="var(--color-bg)"
                strokeWidth={2}
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>

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
