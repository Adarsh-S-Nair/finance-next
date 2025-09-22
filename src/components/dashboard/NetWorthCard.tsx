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
  const { profile, user } = useUser();
  const [hoveredData, setHoveredData] = useState(null);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [currentNetWorth, setCurrentNetWorth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch current net worth and history from the API
  const fetchNetWorthData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      // Fetch current net worth
      const currentResponse = await fetch(`/api/net-worth/current?userId=${user.id}`);
      if (!currentResponse.ok) {
        throw new Error('Failed to fetch current net worth');
      }
      const currentData = await currentResponse.json();
      setCurrentNetWorth(currentData);
      
      // Fetch historical data for the chart
      const historyResponse = await fetch(`/api/net-worth/by-date?userId=${user.id}`);
      if (!historyResponse.ok) {
        throw new Error('Failed to fetch net worth history');
      }
      const historyData = await historyResponse.json();
      
      console.log('🔍 NetWorthCard: Current net worth data:', currentData);
      console.log('🔍 NetWorthCard: Historical data received:', historyData.data?.length || 0, 'entries');
      setNetWorthHistory(historyData.data || []);
    } catch (err) {
      console.error('Error fetching net worth data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when user changes
  useEffect(() => {
    if (user?.id) {
      fetchNetWorthData();
    } else {
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
    }
  }, [user?.id]);

  if (loading) {
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

  // If no historical data, show current net worth as a single point
  if (chartData.length === 0 && currentNetWorth) {
    const now = new Date();
    chartData.push({
      month: now.toLocaleString('en-US', { month: 'short' }),
      monthFull: now.toLocaleString('en-US', { month: 'long' }),
      year: now.getFullYear(),
      date: now,
      dateString: now.toISOString().split('T')[0],
      value: currentNetWorth.netWorth,
      assets: currentNetWorth.assets,
      liabilities: currentNetWorth.liabilities
    });
    console.log('⚠️ NetWorthCard: No historical data found, using current net worth as fallback');
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

  // Get the most recent net worth from the actual data
  const latestNetWorth = chartData.length > 0 ? chartData[chartData.length - 1].value : (currentNetWorth?.netWorth || 0);

  // Get current display data (hovered or most recent)
  const currentData = hoveredData || chartData[chartData.length - 1];
  
  // Fallback data structure when no data is available
  const fallbackData = {
    value: currentNetWorth?.netWorth || 0,
    assets: currentNetWorth?.assets || 0,
    liabilities: currentNetWorth?.liabilities || 0,
    dateString: new Date().toISOString().split('T')[0],
    monthFull: new Date().toLocaleString('en-US', { month: 'long' }),
    year: new Date().getFullYear()
  };
  
  // Use currentData if available, otherwise use fallback
  const displayData = currentData || fallbackData;
  
  // Additional safety check to ensure displayData has required properties
  if (!displayData || typeof displayData.value === 'undefined') {
    console.error('🔍 NetWorthCard: displayData is invalid:', displayData);
    console.error('🔍 NetWorthCard: currentData:', currentData);
    console.error('🔍 NetWorthCard: fallbackData:', fallbackData);
    console.error('🔍 NetWorthCard: currentNetWorth:', currentNetWorth);
  }

  // Handle error state
  if (error) {
    return (
      <Card width="2/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
          <div className="text-2xl font-semibold text-[var(--color-fg)]">
            {formatCurrency(displayData.value)}
          </div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-[var(--color-muted)] mb-2">
                Unable to load historical data
              </div>
              <button 
                onClick={fetchNetWorthData}
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

  console.log('🔍 NetWorthCard: Current data being displayed:', displayData);
  console.log('🔍 NetWorthCard: Latest net worth value:', displayData?.value);
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
              {formatCurrency(displayData.value)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--color-muted)]">
              {displayData.dateString ? 
                new Date(displayData.dateString).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 
                `${displayData.monthFull} ${displayData.year}`
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
