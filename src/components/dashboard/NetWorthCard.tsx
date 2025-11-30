"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import Card from "../ui/Card";
import { useAccounts } from "../AccountsProvider";
import { useUser } from "../UserProvider";
import { useNetWorth } from "../NetWorthProvider";
import { useNetWorthHover } from "./NetWorthHoverContext";
import LineChart from '../ui/LineChart';

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 120 }) {
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

type TimeRange = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export default function NetWorthCard({ width = "full" }: { width?: "full" | "2/3" | "1/3" | "1/2" | "1/4" }) {
  const { profile, user } = useUser();
  const { allAccounts } = useAccounts();
  const {
    netWorthHistory,
    currentNetWorth,
    loading,
    error,
    refreshNetWorthData
  } = useNetWorth();
  const { setHoverData, clearHoverData } = useNetWorthHover();
  const [hoveredData, setHoveredData] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');

  // Process net worth history data for the chart
  const chartData = useMemo(() => {
    const data = netWorthHistory.map((item) => {
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
    if (data.length === 0 && currentNetWorth) {
      const now = new Date();
      data.push({
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
    return data;
  }, [netWorthHistory, currentNetWorth]);

  // Calculate filtered data based on time range
  const filteredData = useMemo(() => {
    if (chartData.length === 0) return [];
    if (timeRange === 'ALL') return chartData;

    const now = new Date();
    let startDate = new Date(now); // Clone now

    switch (timeRange) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return chartData;
    }

    // For 1D, we might want to just show the last few points or just the points after startDate
    // If there are no points in the range, maybe show the last available point?
    // Let's filter by date
    const filtered = chartData.filter(item => item.date >= startDate);

    // If filtered is empty but we have data, maybe show at least the last point?
    if (filtered.length === 0 && chartData.length > 0) {
      return [chartData[chartData.length - 1]];
    }

    return filtered;
  }, [chartData, timeRange]);

  // Ensure we have at least 2 points for a line, duplicating if needed
  const displayChartData = useMemo(() => {
    if (filteredData.length <= 1) {
      const singlePoint = filteredData.length === 1 ? filteredData[0] : (chartData.length > 0 ? chartData[chartData.length - 1] : null);

      if (!singlePoint) return [];

      const originalDate = new Date(singlePoint.date);
      const earlierDate = new Date(originalDate);

      // Determine offset based on range
      let daysOffset = 30;
      if (timeRange === '1D') daysOffset = 1;
      if (timeRange === '1W') daysOffset = 7;

      earlierDate.setDate(earlierDate.getDate() - daysOffset);

      const flatLinePoint = {
        ...singlePoint,
        month: earlierDate.toLocaleString('en-US', { month: 'short' }),
        monthFull: earlierDate.toLocaleString('en-US', { month: 'long' }),
        year: earlierDate.getFullYear(),
        date: earlierDate,
        dateString: earlierDate.toISOString().split('T')[0],
      };

      return [flatLinePoint, singlePoint];
    }
    return filteredData;
  }, [filteredData, chartData, timeRange]);


  // Calculate Percentage Change
  const percentChange = useMemo(() => {
    if (displayChartData.length < 2) return 0;
    const startValue = displayChartData[0].value;
    // Use the currently displayed value (which updates on hover) instead of the last value
    // But we need to be careful: 'displayData' is derived from 'activeIndex' or 'displayChartData.length - 1'
    // So we should use 'displayData.value' here? No, percentChange is memoized on displayChartData only.
    // Let's calculate it in the render or effect if it depends on hover.
    // Actually, the requirement "update with the net worth on that day" means it's dynamic.

    return 0; // Placeholder, calculation moved to render
  }, [displayChartData]);

  // Determine available time ranges
  const availableRanges = useMemo(() => {
    if (chartData.length === 0) return ['ALL'];

    const now = new Date();
    const oldestDate = chartData[0].date;
    const diffTime = Math.abs(now.getTime() - oldestDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const ranges: TimeRange[] = [];
    if (diffDays > 0) ranges.push('1D');
    if (diffDays > 7) ranges.push('1W');
    if (diffDays > 30) ranges.push('1M');
    if (diffDays > 90) ranges.push('3M');

    // YTD check
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    if (oldestDate < startOfYear) ranges.push('YTD');

    if (diffDays > 365) ranges.push('1Y');
    ranges.push('ALL');

    // Deduplicate and sort order if needed, but push order is fine.
    // Ensure 'ALL' is always there.
    return ranges;
  }, [chartData]);

  // Get current display data (hovered or most recent)
  const currentData = activeIndex !== null ? displayChartData[activeIndex] : displayChartData[displayChartData.length - 1];

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

  // Dynamic Percentage Change Calculation
  const dynamicPercentChange = useMemo(() => {
    if (displayChartData.length < 1) return 0;

    const startValue = displayChartData[0].value;
    const currentValue = displayData.value;

    if (startValue === 0) return 0; // Avoid division by zero
    return ((currentValue - startValue) / Math.abs(startValue)) * 100;
  }, [displayChartData, displayData]);

  if (loading) {
    return (
      <Card width={width} className="animate-pulse" variant="glass">
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

  // Handle error state
  if (error) {
    return (
      <Card width={width} variant="glass">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)] font-light">Net Worth</div>
          <div className="text-2xl font-light text-neon-blue">
            <AnimatedCounter value={displayData.value} duration={120} />
          </div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-[var(--color-muted)] mb-2">
                Unable to load historical data
              </div>
              <button
                onClick={refreshNetWorthData}
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
  // For futuristic theme, we prefer the neon accent
  const accentColor = profile?.accent_color && profile.accent_color.startsWith('#')
    ? profile.accent_color
    : (typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-neon-blue').trim()
      : '#00f3ff');

  // Ensure we have a valid color (fallback to a default if needed)
  const validAccentColor = accentColor && accentColor.startsWith('#') ? accentColor : '#00f3ff';

  // Handle chart mouse events
  const handleMouseMove = (data: any, index: number) => {
    setActiveIndex(index);

    // Get the chart data for this index
    const chartDataPoint = displayChartData[index];
    if (chartDataPoint) {
      // Find the corresponding historical data
      const historicalData = netWorthHistory.find(item =>
        new Date(item.date).toISOString().split('T')[0] === chartDataPoint.dateString
      );

      if (historicalData) {
        // Only compute categorized balances if we have accountBalances (non-minimal payload)
        let categorizedBalances = undefined as any;
        if ((historicalData as any).accountBalances) {
          categorizedBalances = categorizeAccountBalances((historicalData as any).accountBalances, allAccounts);
        }

        setHoverData({
          assets: historicalData.assets,
          liabilities: historicalData.liabilities,
          netWorth: historicalData.netWorth,
          date: historicalData.date,
          categorizedBalances: categorizedBalances
        });
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

  // Custom tooltip component
  const CustomTooltip = (data: any, index: number) => {
    const point = displayChartData[index];
    if (!point) return null;

    return (
      <div className="text-center">
        <div className="font-light">{formatCurrency(point.value)}</div>
        <div className="text-xs text-[var(--color-muted)] font-light">
          {point.month} {point.year}
        </div>
      </div>
    );
  };

  // Calculate dynamic chart color based on performance
  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return 'var(--color-success)'; // Default to green
    const startValue = displayChartData[0].value;
    const endValue = displayChartData[displayChartData.length - 1].value;
    return endValue >= startValue ? 'var(--color-success)' : 'var(--color-danger)';
  }, [displayChartData]);

  return (
    <Card width={width} onMouseLeave={handleCardMouseLeave} variant="glass" padding="none">
      <div className="mb-4 px-6 pt-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">Net Worth</div>
            <div className="flex flex-col">
              <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight drop-shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.1)]">
                <AnimatedCounter value={displayData?.value || 0} duration={120} />
              </div>
              <div className={`text-xs font-medium mt-0.5 ${dynamicPercentChange > 0 ? 'text-emerald-500' :
                dynamicPercentChange < 0 ? 'text-rose-500' :
                  'text-[var(--color-muted)]'
                }`}>
                {dynamicPercentChange > 0 ? '+' : ''}
                {formatCurrency(displayData.value - (displayChartData[0]?.value || 0))}
                {' '}
                ({dynamicPercentChange > 0 ? '+' : ''}{dynamicPercentChange.toFixed(2)}%)
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-[var(--color-muted)] font-medium">
              {displayData?.dateString ?
                new Date(displayData.dateString).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) :
                `${displayData?.monthFull || 'Current'} ${displayData?.year || new Date().getFullYear()}`
              }
            </div>


          </div>
        </div>
      </div>

      <div className="pt-4 pb-2">
        <div
          className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
          tabIndex={-1}
          style={{ outline: 'none', height: '200px' }}
          onMouseLeave={handleMouseLeave}
        >
          <LineChart
            data={displayChartData}
            dataKey="value"
            width="100%"
            height={200}
            margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
            strokeColor={chartColor}
            strokeWidth={2}
            showArea={true}
            areaOpacity={0.15}
            showDots={false}
            dotRadius={4}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            showTooltip={false}
            gradientId="netWorthGradient"
            curveType="monotone"
            animationDuration={800}
            xAxisDataKey="dateString"
            yAxisDomain={['dataMin', 'dataMax']}
          />
        </div>
      </div>

      {/* Time Range Selector - moved to bottom and spread evenly */}
      <div className="mt-2 pt-2 px-6 pb-4 border-t border-[var(--color-border)]/50">
        <div className="flex justify-between items-center w-full">
          {availableRanges.map((range) => {
            const isActive = timeRange === range;
            // Check if we're using the default accent color (neon blue)
            const isDefaultAccent = !profile?.accent_color || profile.accent_color === validAccentColor;
            // In dark mode with default accent, use black text for contrast
            const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
            const activeTextColor = (isDarkMode && isDefaultAccent) ? 'var(--color-on-accent)' : '#fff';

            return (
              <div key={range} className="flex-1 flex justify-center">
                <button
                  onClick={() => setTimeRange(range as TimeRange)}
                  className="relative px-3 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none focus:outline-none"
                  style={{
                    color: isActive ? activeTextColor : 'var(--color-muted)'
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTimeRange"
                      className="absolute inset-0 bg-[var(--color-accent)] rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${!isActive ? "hover:text-[var(--color-fg)]" : ""}`}>
                    {range}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
