"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';

interface DataPoint {
  [key: string]: any;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  dataKey: string;
  width?: number | string;
  height?: number | string;
  margin?: { top: number; right: number; bottom: number; left: number };
  strokeColor?: string;
  strokeWidth?: number;
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
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatXAxis?: (value: any) => string;
  formatYAxis?: (value: any) => string;
  tooltip?: (data: DataPoint, index: number) => React.ReactNode;
  showTooltip?: boolean;
  animationDuration?: number;
  curveType?: 'linear' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter';
}

export default function LineChart({
  data = [],
  dataKey = 'value',
  width = '100%',
  height = 200,
  margin = { top: 20, right: 20, bottom: 20, left: 20 },
  strokeColor = 'var(--color-accent)',
  strokeWidth = 2,
  fillColor,
  showDots = false,
  dotColor,
  dotRadius = 2,
  showArea = false,
  areaOpacity = 0.3,
  onMouseMove,
  onMouseLeave,
  className = '',
  style = {},
  gradientId = 'lineChartGradient',
  showGrid = false,
  gridColor = 'var(--color-border)',
  showXAxis = false,
  showYAxis = false,
  xAxisLabel,
  yAxisLabel,
  formatXAxis,
  formatYAxis,
  tooltip,
  showTooltip = false,
  animationDuration = 300,
  curveType = 'monotone'
}: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: typeof width === 'number' ? width : rect.width,
          height: typeof height === 'number' ? height : rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // Calculate chart dimensions
  const chartWidth = dimensions.width - margin.left - margin.right;
  const chartHeight = dimensions.height - margin.top - margin.bottom;

  // Calculate scales and path
  const { pathData, areaPathData, xScale, yScale, points } = useMemo(() => {
    if (!data.length || chartWidth <= 0 || chartHeight <= 0) {
      return { pathData: '', areaPathData: '', xScale: 0, yScale: 0, points: [] };
    }

    const values = data.map(d => d[dataKey] || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const xStep = chartWidth / (data.length - 1 || 1);
    const yScale = (value: number) => 
      chartHeight - ((value - minValue) / valueRange) * chartHeight;

    const points = data.map((d, i) => ({
      x: margin.left + i * xStep,
      y: margin.top + yScale(d[dataKey] || 0),
      data: d,
      index: i
    }));

    // Generate path data based on curve type
    let pathData = '';
    let areaPathData = '';

    if (points.length > 0) {
      if (curveType === 'linear') {
        pathData = points.map((point, i) => 
          `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
        ).join(' ');
      } else if (curveType === 'monotone') {
        // Simple monotone curve approximation
        pathData = points.map((point, i) => {
          if (i === 0) return `M ${point.x} ${point.y}`;
          if (i === points.length - 1) return `L ${point.x} ${point.y}`;
          
          const prev = points[i - 1];
          const next = points[i + 1];
          const cp1x = prev.x + (point.x - prev.x) / 3;
          const cp1y = prev.y;
          const cp2x = point.x - (next.x - point.x) / 3;
          const cp2y = point.y;
          
          return `C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${point.x} ${point.y}`;
        }).join(' ');
      } else {
        // Default to linear for other curve types
        pathData = points.map((point, i) => 
          `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
        ).join(' ');
      }

      // Generate area path
      if (showArea) {
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        areaPathData = `${pathData} L ${lastPoint.x} ${margin.top + chartHeight} L ${firstPoint.x} ${margin.top + chartHeight} Z`;
      }
    }

    return { pathData, areaPathData, xScale: xStep, yScale, points };
  }, [data, dataKey, chartWidth, chartHeight, margin, curveType, showArea]);

  // Handle mouse events
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!data.length || !onMouseMove) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left - margin.left;
    const index = Math.round(x / xScale);
    
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      onMouseMove(data[index], index);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    if (onMouseLeave) onMouseLeave();
  };

  // Generate grid lines
  const gridLines = useMemo(() => {
    if (!showGrid || !data.length) return null;

    const values = data.map(d => d[dataKey] || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    
    const gridLines = [];
    const numLines = 5;
    
    for (let i = 0; i <= numLines; i++) {
      const value = minValue + (valueRange * i) / numLines;
      const y = margin.top + ((maxValue - value) / valueRange) * chartHeight;
      
      gridLines.push(
        <line
          key={`grid-${i}`}
          x1={margin.left}
          x2={margin.left + chartWidth}
          y1={y}
          y2={y}
          stroke={gridColor}
          strokeWidth={1}
          opacity={0.3}
        />
      );
    }
    
    return gridLines;
  }, [showGrid, data, dataKey, chartWidth, chartHeight, margin, gridColor]);

  if (!data.length) {
    return (
      <div 
        ref={containerRef}
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
      className={className}
      style={{ width, height, ...style }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {showArea && (
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={areaOpacity} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.05} />
            </linearGradient>
          )}
        </defs>

        {/* Grid lines */}
        {gridLines}

        {/* Area fill */}
        {showArea && areaPathData && (
          <path
            d={areaPathData}
            fill={`url(#${gradientId})`}
            opacity={areaOpacity}
          />
        )}

        {/* Line */}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots - only show on hover or if showDots is explicitly true */}
        {points.map((point, index) => {
          const isHovered = hoveredIndex === index;
          const shouldShow = showDots || isHovered;
          
          if (!shouldShow) return null;

          return (
            <circle
              key={`dot-${index}`}
              cx={point.x}
              cy={point.y}
              r={isHovered ? dotRadius + 2 : dotRadius}
              fill={dotColor || strokeColor}
              stroke="white"
              strokeWidth={isHovered ? 2 : 1}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Tooltip */}
        {showTooltip && tooltip && hoveredIndex !== null && (
          <foreignObject
            x={points[hoveredIndex]?.x - 50}
            y={points[hoveredIndex]?.y - 40}
            width={100}
            height={30}
          >
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs">
              {tooltip(data[hoveredIndex], hoveredIndex)}
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}
