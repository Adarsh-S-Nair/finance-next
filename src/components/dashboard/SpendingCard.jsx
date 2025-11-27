"use client";

import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';
import { FiArrowDownRight, FiCreditCard } from 'react-icons/fi';

export default function SpendingCard() {
  const { user } = useUser();
  const [spendingData, setSpendingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSpendingData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        // Fetch last 6 months to calculate trend
        const response = await fetch(`/api/transactions/spending-earning?userId=${user.id}&months=6`);

        if (!response.ok) {
          throw new Error('Failed to fetch spending data');
        }

        const result = await response.json();
        const months = result.data || [];

        // Get current month (or last available month)
        const currentMonth = months.length > 0 ? months[months.length - 1] : null;
        const previousMonth = months.length > 1 ? months[months.length - 2] : null;

        setSpendingData({
          current: currentMonth?.spending || 0,
          previous: previousMonth?.spending || 0,
          monthName: currentMonth?.monthName || 'Current Month',
          history: months // Pass full history for chart
        });

      } catch (err) {
        console.error('Error fetching spending data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSpendingData();
  }, [user?.id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card width="full" variant="glass" className="h-full">
        <div className="animate-pulse flex flex-col h-full justify-between">
          <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-2" />
          <div className="h-8 bg-[var(--color-border)] rounded w-32" />
          <div className="h-4 bg-[var(--color-border)] rounded w-16 mt-2" />
        </div>
      </Card>
    );
  }

  const currentSpending = spendingData?.current || 0;
  const previousSpending = spendingData?.previous || 0;

  // Calculate percentage change
  const percentChange = previousSpending === 0 ? 0 : ((currentSpending - previousSpending) / previousSpending) * 100;
  const isGoodChange = percentChange <= 0;

  // Curved Area Chart Component
  const CurvedChart = ({ data, color = "currentColor" }) => {
    if (!data || data.length < 2) return null;

    const height = 150;
    const width = 300;
    const padding = 5;

    const values = data.map(d => d.spending);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    // Coordinate calculation
    const points = values.map((val, i) => {
      const x = (i / (values.length - 1)) * width;
      // Add padding to avoid cutting off peaks
      // Lower the graph by multiplying by 0.6 (60% height) and adding offset
      const y = height - ((val - min) / range) * (height * 0.6) - padding;
      return [x, y];
    });

    // Smoothing logic (Catmull-Rom to Bezier)
    const line = (pointA, pointB) => {
      const lengthX = pointB[0] - pointA[0];
      const lengthY = pointB[1] - pointA[1];
      return {
        length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
        angle: Math.atan2(lengthY, lengthX)
      };
    };

    const controlPoint = (current, previous, next, reverse) => {
      const p = previous || current;
      const n = next || current;
      const o = line(p, n);
      const angle = o.angle + (reverse ? Math.PI : 0);
      const length = o.length * 0.2;
      const x = current[0] + Math.cos(angle) * length;
      const y = current[1] + Math.sin(angle) * length;
      return [x, y];
    };

    const bezierCommand = (point, i, a) => {
      const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
      const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
      return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
    };

    const d = points.reduce((acc, point, i, a) => i === 0
      ? `M ${point[0]},${point[1]}`
      : `${acc} ${bezierCommand(point, i, a)}`
      , '');

    // Close the path for fill
    const fillPath = `${d} L ${width},${height} L 0,${height} Z`;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d={fillPath}
          fill="url(#spendingGradient)"
        />
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <Card width="full" padding="none" title="Spending" className="h-full relative overflow-hidden group rounded-3xl">
      <div className="relative z-10 flex flex-col h-full justify-between p-5 pt-0">
        <div>
          <div className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
            {formatCurrency(currentSpending)}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <span className={`text-sm font-medium flex items-center gap-0.5 ${percentChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">vs last month</span>
        </div>
      </div>

      {/* Background Chart - positioned to fill bottom area */}
      <div className="absolute inset-x-0 bottom-0 h-32 z-0 text-rose-500 opacity-20 pointer-events-none translate-y-4">
        <CurvedChart data={spendingData?.history || []} color="currentColor" />
      </div>
    </Card>
  );
}
