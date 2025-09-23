"use client";

import React, { useState, useEffect, useRef } from "react";
import Card from "../ui/Card";
import { useAccounts } from "../AccountsProvider";
import { useUser } from "../UserProvider";
import { useNetWorthHover } from "./NetWorthHoverContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 300 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef(null);

  useEffect(() => {
    if (displayValue === value) return;

    setIsAnimating(true);
    
    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeOutCubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, displayValue]);

  return (
    <span className={isAnimating ? 'transition-all duration-150' : ''}>
      {formatCurrency(displayValue)}
    </span>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Helper function to categorize account balances (same logic as AccountsSummaryCard)
function categorizeAccount(account) {
  const accountType = (account.type || '').toLowerCase();
  const accountSubtype = (account.subtype || '').toLowerCase();
  const fullType = `${accountType} ${accountSubtype}`.trim();
  
  // Check if it's a liability first
  const liabilityTypes = [
    'credit card', 'credit', 'loan', 'mortgage', 
    'line of credit', 'overdraft', 'other'
  ];
  
  const isLiability = liabilityTypes.some(type => fullType.includes(type));
  
  if (isLiability) {
    // Categorize liabilities
    if (fullType.includes('credit card') || fullType.includes('credit')) {
      return 'credit';
    } else if (fullType.includes('loan') || fullType.includes('mortgage') || fullType.includes('line of credit')) {
      return 'loans';
    } else {
      return 'credit'; // Default to credit for other liability types
    }
  } else {
    // Categorize assets
    if (fullType.includes('investment') || fullType.includes('brokerage') || 
        fullType.includes('401k') || fullType.includes('ira') || 
        fullType.includes('retirement') || fullType.includes('mutual fund') ||
        fullType.includes('stock') || fullType.includes('bond')) {
      return 'investments';
    } else {
      return 'cash'; // Default to cash for checking, savings, etc.
    }
  }
}

// Helper function to categorize account balances for historical data
function categorizeAccountBalances(accountBalances, allAccounts) {
  const categorized = {
    cash: 0,
    investments: 0,
    credit: 0,
    loans: 0
  };

  // Create a map of account ID to account details for quick lookup
  const accountMap = {};
  allAccounts.forEach(account => {
    accountMap[account.id] = account;
  });

  // Categorize each account balance
  Object.entries(accountBalances).forEach(([accountId, balance]) => {
    const account = accountMap[accountId];
    if (account) {
      const category = categorizeAccount(account);
      const amount = Math.abs(Number(balance) || 0);
      categorized[category] += amount;
    }
  });

  return categorized;
}

export default function NetWorthCard() {
  const { profile, user } = useUser();
  const { allAccounts } = useAccounts();
  const { setHoverData, clearHoverData } = useNetWorthHover();
  const [hoveredData, setHoveredData] = useState(null);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [currentNetWorth, setCurrentNetWorth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

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
  const currentData = activeIndex !== null ? chartData[activeIndex] : chartData[chartData.length - 1];
  
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
            <AnimatedCounter value={displayData.value} duration={250} />
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

  // Handle chart mouse events
  const handleMouseMove = (data: any) => {
    if (data && data.activeIndex !== undefined) {
      const index = parseInt(data.activeIndex);
      setActiveIndex(index);
      
      // Get the chart data for this index
      const chartDataPoint = chartData[index];
      if (chartDataPoint) {
        // Find the corresponding historical data
        const historicalData = netWorthHistory.find(item => 
          new Date(item.date).toISOString().split('T')[0] === chartDataPoint.dateString
        );
        
        if (historicalData) {
          // Categorize the account balances for the AccountsSummaryCard
          const categorizedBalances = categorizeAccountBalances(historicalData.accountBalances, allAccounts);
          
          setHoverData({
            assets: historicalData.assets,
            liabilities: historicalData.liabilities,
            netWorth: historicalData.netWorth,
            date: historicalData.date,
            categorizedBalances: categorizedBalances
          });
        }
      }
    }
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
    clearHoverData();
  };

  // Handle mouse leave from the entire card area
  const handleCardMouseLeave = () => {
    setActiveIndex(null);
    clearHoverData();
  };

  // Custom dot component that only shows on hover
  const CustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    const isHovered = activeIndex === index;
    
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
    <Card width="2/3" onMouseLeave={handleCardMouseLeave}>
      <div className="mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-[var(--color-muted)]">Net Worth</div>
            <div className="text-2xl font-semibold text-[var(--color-fg)]">
              <AnimatedCounter value={displayData?.value || 0} duration={250} />
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
          className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
          tabIndex={-1}
          style={{ outline: 'none', height: '200px' }}
          onMouseLeave={handleMouseLeave}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              onMouseMove={handleMouseMove}
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
