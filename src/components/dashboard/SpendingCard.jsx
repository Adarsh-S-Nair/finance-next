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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
  // For spending, usually less is better, but let's stick to standard red/green for up/down or context aware?
  // User didn't specify, but usually spending up is "bad" (red) and down is "good" (green).
  // However, for consistency with trends: Up = Red (more spending), Down = Green (less spending).
  const isGoodChange = percentChange <= 0;

  // Filled Area Sparkline Component
  const Sparkline = ({ data, color = "currentColor" }) => {
    if (!data || data.length < 2) return null;

    const height = 100;
    const width = 200;
    const max = Math.max(...data.map(d => d.spending));
    const min = Math.min(...data.map(d => d.spending));
    const range = max - min || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.spending - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const fillPoints = `${points} ${width},${height} 0,${height}`;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polygon
          points={fillPoints}
          fill="url(#spendingGradient)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  return (
    <Card width="full" className="h-full relative overflow-hidden group">
      {/* Background Sparkline */}
      <div className="absolute inset-x-0 bottom-0 h-24 z-0 text-rose-500 opacity-30 pointer-events-none">
        <Sparkline data={spendingData?.history || []} color="currentColor" />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between p-1">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-muted)] mb-1">Spending</h3>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(currentSpending)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs font-bold flex items-center gap-0.5 ${!isGoodChange ? 'text-rose-500' : 'text-emerald-500'}`}>
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </span>
          <span className="text-xs text-[var(--color-muted)] font-medium">vs last month</span>
        </div>
      </div>
    </Card>
  );
}
