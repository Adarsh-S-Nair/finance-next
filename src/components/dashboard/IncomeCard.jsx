"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';

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

export default function IncomeCard() {
  const { user } = useUser();
  const [income, setIncome] = useState(0);
  const [trendData, setTrendData] = useState([]);
  const [momChange, setMomChange] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncomeData = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`/api/transactions/spending-earning?userId=${user.id}&months=6`);
        const data = await response.json();

        if (data.data) {
          // Get last 6 months for the chart
          const last6Months = data.data.slice(-6);
          const incomeTrend = last6Months.map(m => m.earning);
          setTrendData(incomeTrend);

          const currentMonthData = data.data[data.data.length - 1];
          setIncome(currentMonthData?.earning || 0);

          if (data.momComparison) {
            setMomChange(data.momComparison.incomeChange);
          }
        }
      } catch (error) {
        console.error("Failed to fetch income data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncomeData();
  }, [user?.id]);

  const formatCurrencyParts = (amount) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    const [main, cents] = formatted.split('.');
    return { main, cents };
  };

  const { areaPath, linePath } = useMemo(() => {
    if (!trendData || trendData.length < 2) return { areaPath: "", linePath: "" };

    const width = 100;
    const height = 100;
    const max = Math.max(...trendData);
    const min = Math.min(...trendData);
    const range = max - min || 1;
    const padding = range * 0.2;
    const adjustedMin = min - padding;
    const adjustedRange = range + padding * 2;
    const stepX = width / (trendData.length - 1);

    const points = trendData.map((val, i) => {
      const x = i * stepX;
      const y = height - ((val - adjustedMin) / adjustedRange) * height;
      return [x, y];
    });

    const smoothLine = generateSmoothPath(points);
    const area = `${smoothLine} L ${width},${height} L 0,${height} Z`;

    return { areaPath: area, linePath: smoothLine };
  }, [trendData]);

  const { main, cents } = formatCurrencyParts(income);

  return (
    <Card
      variant="glass"
      padding="none"
      className="relative overflow-hidden h-32 flex flex-col justify-between rounded-3xl group"
    >
      <div className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-[var(--color-muted)]">Income</h3>
          <span className="text-xs font-medium text-[var(--color-muted)]">Last 6 Months</span>
        </div>
        <div className="text-2xl font-semibold text-[var(--color-fg)] tracking-tight">
          {loading ? (
            <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          ) : (
            <span>
              {main}
              <span className="text-lg text-[var(--color-muted)] font-medium">.{cents}</span>
            </span>
          )}
        </div>
        <div className="flex items-center mt-1">
          {loading ? (
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          ) : (
            <span className={`text-xs font-medium ${momChange >= 0
              ? 'text-emerald-500'
              : 'text-rose-500'
              }`}>
              {momChange >= 0 ? '+' : ''}{momChange.toFixed(1)}%
              <span className="text-[var(--color-muted)] ml-1">vs last month</span>
            </span>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 w-full z-0 pointer-events-none">
        {!loading && trendData.length > 0 && (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.02" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill="url(#incomeGradient)"
              className="transition-all duration-1000 ease-out"
            />
            <path
              d={linePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="transition-all duration-1000 ease-out opacity-10"
            />
          </svg>
        )}
      </div>
    </Card>
  );
}
