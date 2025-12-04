"use client";

import React, { useState, useEffect, useMemo } from "react";
import Card from "../ui/Card";
import { useUser } from "../UserProvider";
import { useNetWorth } from "../NetWorthProvider";

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 1000 }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(startValue + (endValue - startValue) * ease);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value]);

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayValue);

  const [main, cents] = formatted.split('.');

  return (
    <span>
      {main}
      <span className="text-lg text-[var(--color-muted)] font-medium">.{cents}</span>
    </span>
  );
}

// Helper for smooth Bezier curves
const getControlPoint = (current, previous, next, reverse, smoothing = 0.2) => {
  const p = previous || current;
  const n = next || current;
  const lengthX = n[0] - p[0];
  const lengthY = n[1] - p[1];
  const length = Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2));
  const angle = Math.atan2(lengthY, lengthX) + (reverse ? Math.PI : 0);
  const x = current[0] + Math.cos(angle) * length * smoothing;
  const y = current[1] + Math.sin(angle) * length * smoothing;
  return [x, y];
};

const generateSmoothPath = (points) => {
  if (!points || points.length === 0) return "";

  return points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point[0]},${point[1]}`;

    const [cpsX, cpsY] = getControlPoint(a[i - 1], a[i - 2], point, false);
    const [cpeX, cpeY] = getControlPoint(point, a[i - 1], a[i + 1], true);

    return `${acc} C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
  }, "");
};

export default function DashboardNetWorthCard() {
  const { profile } = useUser();
  const { netWorthHistory, currentNetWorth, loading } = useNetWorth();

  const chartData = useMemo(() => {
    if (!netWorthHistory?.length) return [];
    return netWorthHistory.map(item => item.netWorth);
  }, [netWorthHistory]);

  const percentChange = useMemo(() => {
    if (chartData.length < 2) return 0;
    const current = chartData[chartData.length - 1];
    const start = chartData[0];
    if (start === 0) return 0;
    return ((current - start) / Math.abs(start)) * 100;
  }, [chartData]);

  const netWorthValue = currentNetWorth?.netWorth || 0;
  const isLoadingState = loading;

  const { areaPath, linePath } = useMemo(() => {
    if (!chartData || chartData.length < 2) return { areaPath: "", linePath: "" };

    const width = 100;
    const height = 100;
    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const range = max - min || 1;
    // Add padding to prevent flat lines at top/bottom
    const padding = range * 0.2;
    const adjustedMin = min - padding;
    const adjustedRange = range + padding * 2;
    const stepX = width / (chartData.length - 1);

    const points = chartData.map((val, i) => {
      const x = i * stepX;
      // Invert Y because SVG 0 is top
      const y = height - ((val - adjustedMin) / adjustedRange) * height;
      return [x, y];
    });

    const smoothLine = generateSmoothPath(points);
    const area = `${smoothLine} L ${width},${height} L 0,${height} Z`;

    return { areaPath: area, linePath: smoothLine };
  }, [chartData]);

  return (
    <Card
      variant="glass"
      padding="none"
      className="relative overflow-hidden h-32 flex flex-col justify-between rounded-3xl group"
    >
      <div className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-[var(--color-muted)]">Net Worth</h3>
          <span className="text-xs font-medium text-[var(--color-muted)]">Total Assets</span>
        </div>
        <div className="text-2xl font-semibold text-[var(--color-fg)] tracking-tight">
          <AnimatedCounter value={netWorthValue} />
        </div>
        <div className="text-xs font-medium text-[var(--color-muted)] mt-1">
          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}% from last month
        </div>
      </div>

      {/* Chart Layer */}
      <div className="absolute bottom-0 left-0 right-0 h-24 w-full z-0 pointer-events-none">
        {!isLoadingState && chartData.length > 1 && (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="netWorthGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill="url(#netWorthGradient)"
              className="transition-all duration-1000 ease-out"
            />
            <path
              d={linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="transition-all duration-1000 ease-out opacity-10"
            />
          </svg>
        )}
        {isLoadingState && (
          <div className="absolute inset-0 shimmer" />
        )}
      </div>
    </Card>
  );
}
