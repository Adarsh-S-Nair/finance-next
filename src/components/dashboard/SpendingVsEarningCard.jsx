"use client";

import React, { useState, useMemo, useEffect } from "react";
import Card from "../ui/Card";
import SpendingEarningChart from "./SpendingEarningChartV2";
import Dropdown from "../ui/Dropdown";
import { useUser } from "../UserProvider";
import { useNetWorth } from "../NetWorthProvider";
import { useRouter } from "next/navigation";
import { FiChevronUp, FiChevronDown } from "react-icons/fi";

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

export default function SpendingVsEarningCard() {
  const { user } = useUser();
  const { netWorthHistory, currentNetWorth } = useNetWorth();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState('6');
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredData, setHoveredData] = useState(null);

  // Period options
  const periodOptions = [
    { label: '6 Months', value: '6' },
    { label: '12 Months', value: '12' },
    { label: 'Year to Date', value: 'ytd' },
  ];

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        // Determine months parameter based on selectedPeriod
        let monthsParam = selectedPeriod;
        if (selectedPeriod === 'ytd') {
          const currentMonth = new Date().getMonth(); // 0-indexed
          monthsParam = (currentMonth + 1).toString(); // Convert to 1-indexed month count
        }

        const response = await fetch(`/api/transactions/spending-earning?userId=${user.id}&months=${monthsParam}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        setChartData(result.data || []);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.id, selectedPeriod]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate totals
  const { totalIncome, totalSpending } = useMemo(() => {
    if (!chartData.length) return { totalIncome: 0, totalSpending: 0 };
    const income = chartData.reduce((acc, curr) => acc + (curr.earning || 0), 0);
    const spending = chartData.reduce((acc, curr) => acc + (curr.spending || 0), 0);
    return {
      totalIncome: income,
      totalSpending: spending
    };
  }, [chartData]);

  // Determine values to display (hovered or total)
  const displayIncome = hoveredData ? hoveredData.earning : totalIncome;
  const displaySpending = hoveredData ? hoveredData.spending : totalSpending;
  const isIncomeHigher = displayIncome >= displaySpending;

  const showLoading = isLoading;

  const handleSelectMonth = (data) => {
    if (!data) return;
    const { year, monthNumber } = data;

    // Format dates for URL params
    const monthStr = String(monthNumber).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;

    // Get last day of month
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // Navigate to transactions page with date filter
    const params = new URLSearchParams({
      dateRange: 'custom',
      startDate,
      endDate
    });

    router.push(`/transactions?${params.toString()}`);
  };

  // Net Worth Calculations
  const netWorthChartData = useMemo(() => {
    if (!netWorthHistory?.length) return [];
    return netWorthHistory.map(item => item.netWorth);
  }, [netWorthHistory]);

  const percentChange = useMemo(() => {
    if (netWorthChartData.length < 2) return 0;
    const current = netWorthChartData[netWorthChartData.length - 1];
    const start = netWorthChartData[0];
    if (start === 0) return 0;
    return ((current - start) / Math.abs(start)) * 100;
  }, [netWorthChartData]);

  const netWorthValue = currentNetWorth?.netWorth || 0;

  return (
    <Card padding="none" className={`h-full relative overflow-hidden ${showLoading ? 'bg-zinc-100 dark:bg-zinc-900/50' : ''}`}>
      {showLoading && (
        <div className="absolute inset-0 z-20 shimmer pointer-events-none" />
      )}

      <div className={`h-full flex flex-col ${showLoading ? 'opacity-0' : ''}`}>
        {/* Custom Header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0">
          <div className="flex items-start justify-between gap-2">
            {/* Title and Values */}
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-normal text-[var(--color-fg)] mb-1">
                Net Worth
              </div>

              <div className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--color-fg)] mb-1 sm:mb-2">
                <AnimatedCounter value={netWorthValue} />
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className={`flex items-center gap-0.5 font-medium ${percentChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {percentChange >= 0 ? (
                    <FiChevronUp className="w-3 h-3" />
                  ) : (
                    <FiChevronDown className="w-3 h-3" />
                  )}
                  {Math.abs(percentChange).toFixed(1)}%
                </span>
                <span className="text-[var(--color-muted)] hidden sm:inline">vs last month</span>
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex flex-col items-end gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => router.push('/accounts')}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-[var(--color-fg)] bg-transparent border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-hover)] transition-colors whitespace-nowrap"
              >
                View Accounts
              </button>

              {/* Legend - stacked on mobile, horizontal on desktop */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-cashflow-income)]" />
                  <span className="text-xs text-[var(--color-muted)]">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-cashflow-spending)]" />
                  <span className="text-xs text-[var(--color-muted)]">Spending</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart - fills remaining space */}
        <div className="flex-1 min-h-0 w-full">
          <SpendingEarningChart
            data={chartData}
            onHover={(data) => setHoveredData(data)}
            onSelectMonth={handleSelectMonth}
          />
        </div>
      </div>
    </Card>
  );
}
