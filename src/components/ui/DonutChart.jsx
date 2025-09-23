"use client";

import React, { useRef, useEffect, useState, useMemo } from 'react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DonutChart({ 
  data = [], 
  width = 200, 
  height = 200, 
  innerRadius = 60, 
  outerRadius = 90,
  onCategoryHover = null,
  activeCategory = null 
}) {
  const svgRef = useRef(null);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Calculate total for percentage calculations
  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + (item.value || item.total_spent || 0), 0);
  }, [data]);

  // Generate colors for categories
  const generateColors = (count) => {
    const baseColors = [
      'var(--color-accent)',
      '#3B82F6', // blue
      '#10B981', // emerald
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // violet
      '#06B6D4', // cyan
      '#84CC16', // lime
      '#F97316', // orange
      '#EC4899', // pink
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const colors = generateColors(data.length);
    let currentAngle = 0;
    
    return data.map((item, index) => {
      const value = item.value || item.total_spent || 0;
      const percentage = total > 0 ? (value / total) * 100 : 0;
      const angle = (value / total) * 360;
      
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      currentAngle += angle;
      
      return {
        ...item,
        value,
        percentage,
        startAngle,
        endAngle,
        color: colors[index],
        index
      };
    });
  }, [data, total]);

  // Convert angle to radians
  const toRadians = (angle) => (angle * Math.PI) / 180;

  // Create arc path
  const createArcPath = (startAngle, endAngle, innerR, outerR) => {
    const start = polarToCartesian(width / 2, height / 2, outerR, endAngle);
    const end = polarToCartesian(width / 2, height / 2, outerR, startAngle);
    const innerStart = polarToCartesian(width / 2, height / 2, innerR, endAngle);
    const innerEnd = polarToCartesian(width / 2, height / 2, innerR, startAngle);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", start.x, start.y,
      "A", outerR, outerR, 0, largeArcFlag, 0, end.x, end.y,
      "L", innerEnd.x, innerEnd.y,
      "A", innerR, innerR, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
      "Z"
    ].join(" ");
  };

  // Convert polar coordinates to cartesian
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = toRadians(angleInDegrees);
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Handle mouse events
  const handleMouseEnter = (category) => {
    setHoveredCategory(category);
    if (onCategoryHover) {
      onCategoryHover(category);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCategory(null);
    if (onCategoryHover) {
      onCategoryHover(null);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-[var(--color-muted)] mb-2">No Data</div>
          <div className="text-xs text-[var(--color-muted)]">
            No spending data available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={outerRadius}
          fill="var(--color-surface)"
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        
        {/* Donut segments */}
        {chartData.map((segment) => {
          const isHovered = hoveredCategory?.id === segment.id || activeCategory?.id === segment.id;
          const isActive = activeCategory?.id === segment.id;
          
          return (
            <path
              key={segment.id || segment.index}
              d={createArcPath(segment.startAngle, segment.endAngle, innerRadius, outerRadius)}
              fill={segment.color}
              stroke="var(--color-bg)"
              strokeWidth="1"
              opacity={isHovered ? 0.8 : 1}
              style={{
                transition: 'opacity 150ms ease, transform 150ms ease',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transformOrigin: `${width / 2}px ${height / 2}px`,
                cursor: 'pointer',
                filter: isActive ? 'brightness(1.1) drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : 'none'
              }}
              onMouseEnter={() => handleMouseEnter(segment)}
              onMouseLeave={handleMouseLeave}
            />
          );
        })}
        
        {/* Center text */}
        <text
          x={width / 2}
          y={height / 2 - 8}
          textAnchor="middle"
          className="text-[var(--color-fg)]"
          fontSize="16"
          fontWeight="600"
        >
          {formatCurrency(total)}
        </text>
        <text
          x={width / 2}
          y={height / 2 + 8}
          textAnchor="middle"
          className="text-[var(--color-muted)]"
          fontSize="12"
        >
          Total Spending
        </text>
      </svg>
      
      {/* Legend */}
      <div className="mt-4 space-y-2">
        {chartData.map((segment) => (
          <div
            key={segment.id || segment.index}
            className="flex items-center gap-2 text-xs"
            onMouseEnter={() => handleMouseEnter(segment)}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: 'pointer' }}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-[var(--color-fg)] flex-1 truncate">
              {segment.label || segment.name}
            </span>
            <span className="text-[var(--color-muted)] flex-shrink-0">
              {segment.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

