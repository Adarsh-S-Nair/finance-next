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
  }[];
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
}: LineChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

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
    }];
  }, [lines, dataKey, strokeColor, strokeWidth, strokeOpacity, gradientId, showArea, areaOpacity]);

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
            {chartLines.map((line) => (
              <linearGradient key={line.gradientId} id={line.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={line.strokeColor} stopOpacity={line.areaOpacity} />
                <stop offset="95%" stopColor={line.strokeColor} stopOpacity={0} />
              </linearGradient>
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

          {chartLines.map((line) => (
            <Area
              key={line.dataKey}
              type={curveType}
              dataKey={line.dataKey}
              stroke={line.strokeColor}
              strokeWidth={line.strokeWidth}
              strokeOpacity={line.strokeOpacity}
              strokeDasharray={line.strokeDasharray}
              fill={line.showArea ? `url(#${line.gradientId})` : 'none'}
              animationDuration={animationDuration}
              activeDot={false} // We handle active dot manually
              dot={showDots ? {
                r: dotRadius,
                fill: dotColor || line.strokeColor,
                strokeWidth: 0
              } : false}
            />
          ))}

          {/* Manual Active Visuals */}
          {activeIndex !== null && (
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
