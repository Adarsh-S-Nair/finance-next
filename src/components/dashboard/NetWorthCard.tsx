"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const [isMouseOverChart, setIsMouseOverChart] = useState(false);
  const hoverTimeoutRef = useRef(null);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

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


  // Get accent color once - ensure it's a valid hex color
  const accentColor = profile?.accent_color || (typeof window !== 'undefined' ? 
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() : 
    '#484444'
  );
  
  // Ensure we have a valid color (fallback to a default if needed)
  const validAccentColor = accentColor && accentColor.startsWith('#') ? accentColor : '#484444';

  // Handle mouse enter on chart
  const handleMouseEnter = () => {
    setIsMouseOverChart(true);
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Handle mouse leave on chart
  const handleMouseLeave = () => {
    setIsMouseOverChart(false);
    // Clear hovered data after a short delay
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredData(null);
    }, 100);
  };

  // Handle mouse move on chart
  const handleMouseMove = (data: any) => {
    if (data && data.activeIndex !== undefined && isMouseOverChart) {
      const activeIndex = parseInt(data.activeIndex);
      if (activeIndex >= 0 && activeIndex < chartData.length) {
        const hoveredPayload = chartData[activeIndex];
        setHoveredData(hoveredPayload);
        
        // Clear any existing timeout and set a new one
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
          if (!isMouseOverChart) {
            setHoveredData(null);
          }
        }, 200);
      }
    }
  };

  // Custom dot component that only shows on hover
  const CustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    const isHovered = hoveredData && hoveredData.dateString === payload.dateString;
    
    if (!isHovered) {
      return null;
    }
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={validAccentColor}
        stroke="white"
        strokeWidth={2}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  return (
    <Card width="2/3">
      <div className="mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
            <div className="text-2xl font-semibold text-[var(--color-fg)]">
              {formatCurrency(displayData?.value || 0)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--color-muted)]">
              {displayData?.dateString ? 
                new Date(displayData.dateString).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                }) : 
                `${displayData?.monthFull || 'Current'} ${displayData?.year || new Date().getFullYear()}`
              }
            </div>
          </div>
        </div>
      </div>
      
      <div className="pt-4">
        <div 
          className="h-40 w-full"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              onMouseMove={handleMouseMove}
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
              <Line
                type="monotone"
                dataKey="value"
                stroke="transparent"
                strokeWidth={8}
                dot={<CustomDot />}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
