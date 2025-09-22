"use client";

import React, { useState, useEffect } from "react";
import Card from "../ui/Card";
import { useAccounts } from "../AccountsProvider";
import { useUser } from "../UserProvider";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function NetWorthCard() {
  const { totalBalance, totalAssets, totalLiabilities, loading } = useAccounts();
  const { profile, user } = useUser();
  const [hoveredData, setHoveredData] = useState(null);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Fetch net worth history from the API
  const fetchNetWorthHistory = async () => {
    if (!user?.id) return;

    try {
      setHistoryLoading(true);
      setHistoryError(null);
      
      const response = await fetch(`/api/net-worth/dates?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch net worth history');
      }
      
      const data = await response.json();
      console.log('🔍 NetWorthCard: API Response:', data);
      console.log('🔍 NetWorthCard: Historical data received:', data.data?.length || 0, 'entries');
      console.log('🔍 NetWorthCard: Sample data from API:', data.data?.slice(0, 3));
      console.log('🔍 NetWorthCard: Total snapshots in DB:', data.totalSnapshots);
      console.log('🔍 NetWorthCard: Total accounts:', data.totalAccounts);
      setNetWorthHistory(data.data || []);
    } catch (err) {
      console.error('Error fetching net worth history:', err);
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch data when user changes
  useEffect(() => {
    if (user?.id) {
      fetchNetWorthHistory();
    } else {
      setNetWorthHistory([]);
      setHistoryError(null);
    }
  }, [user?.id]);

  if (loading || historyLoading) {
    return (
      <Card width="2/3" className="animate-pulse">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-2" />
            <div className="h-6 bg-[var(--color-border)] rounded w-32" />
          </div>
        </div>
        <div className="mt-4 h-32 bg-[var(--color-border)] rounded" />
      </Card>
    );
  }

  // Process net worth history data for the chart
  const chartData = netWorthHistory.map((item) => {
    const date = new Date(item.date);
    return {
      month: date.toLocaleString('en-US', { month: 'short' }),
      monthFull: date.toLocaleString('en-US', { month: 'long' }),
      year: date.getFullYear(),
      date: date,
      dateString: item.date, // Keep original date string for exact display
      value: item.netWorth || 0,
      assets: item.assets || 0,
      liabilities: item.liabilities || 0
    };
  });

  console.log('🔍 NetWorthCard: Processed chart data:', chartData.slice(-3));

  // If no historical data, show current balance as a single point
  if (chartData.length === 0) {
    const now = new Date();
    chartData.push({
      month: now.toLocaleString('en-US', { month: 'short' }),
      monthFull: now.toLocaleString('en-US', { month: 'long' }),
      year: now.getFullYear(),
      date: now,
      dateString: now.toISOString().split('T')[0],
      value: totalBalance,
      assets: totalAssets,
      liabilities: totalLiabilities
    });
    console.log('⚠️ NetWorthCard: No historical data found, using current balance as fallback');
  }

  // If only one data point, create a flat line by duplicating it
  if (chartData.length === 1) {
    const singlePoint = chartData[0];
    const originalDate = new Date(singlePoint.date);
    
    // Create a second point 30 days earlier with the same value
    const earlierDate = new Date(originalDate);
    earlierDate.setDate(earlierDate.getDate() - 30);
    
    const flatLinePoint = {
      month: earlierDate.toLocaleString('en-US', { month: 'short' }),
      monthFull: earlierDate.toLocaleString('en-US', { month: 'long' }),
      year: earlierDate.getFullYear(),
      date: earlierDate,
      dateString: earlierDate.toISOString().split('T')[0],
      value: singlePoint.value,
      assets: singlePoint.assets,
      liabilities: singlePoint.liabilities
    };
    
    // Insert at the beginning to maintain chronological order
    chartData.unshift(flatLinePoint);
    console.log('📈 NetWorthCard: Single data point detected, created flat line');
  }

  // Get the most recent net worth from the actual data (not from AccountsProvider)
  const latestNetWorth = chartData.length > 0 ? chartData[chartData.length - 1].value : totalBalance;

  // Handle error state
  if (historyError) {
    return (
      <Card width="2/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
          <div className="text-2xl font-semibold text-[var(--color-fg)]">
            {formatCurrency(latestNetWorth)}
          </div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-[var(--color-muted)] mb-2">
                Unable to load historical data
              </div>
              <button 
                onClick={fetchNetWorthHistory}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Get current display data (hovered or most recent)
  const currentData = hoveredData || chartData[chartData.length - 1];
  
  console.log('🔍 NetWorthCard: Current data being displayed:', currentData);
  console.log('🔍 NetWorthCard: Latest net worth value:', currentData?.value);
  console.log('🔍 NetWorthCard: Is using real data?', netWorthHistory.length > 0);

  // Get accent color once - ensure it's a valid hex color
  const accentColor = profile?.accent_color || (typeof window !== 'undefined' ? 
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() : 
    '#484444'
  );
  
  // Ensure we have a valid color (fallback to a default if needed)
  const validAccentColor = accentColor && accentColor.startsWith('#') ? accentColor : '#484444';

  // Handle mouse enter on chart
  const handleMouseEnter = (data: any) => {
    if (data && data.payload) {
      setHoveredData(data.payload);
    }
  };

  // Handle mouse leave on chart
  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  return (
    <Card width="2/3">
      <div className="mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
            <div className="text-2xl font-semibold text-[var(--color-fg)]">
              {formatCurrency(currentData.value)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--color-muted)]">
              {currentData.dateString ? 
                new Date(currentData.dateString).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 
                `${currentData.monthFull} ${currentData.year}`
              }
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-4">
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={validAccentColor} stopOpacity={0.3}/>
                  <stop offset="50%" stopColor={validAccentColor} stopOpacity={0.15}/>
                  <stop offset="100%" stopColor={validAccentColor} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={validAccentColor}
                strokeWidth={2}
                fill="url(#netWorthGradient)"
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
