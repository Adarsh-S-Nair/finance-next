"use client";

import React, { useState, useMemo, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import SpendingEarningChart from "./SpendingEarningChartV2";
import { useUser } from "../providers/UserProvider";
import TimeRangeSelector from "../ui/TimeRangeSelector";
import { useRouter } from "next/navigation";



// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 1000, showCents = true }) {
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

  const number = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(Math.abs(displayValue));

  const isNegative = displayValue < 0;

  if (!showCents) {
    return (
      <span className="inline-flex items-baseline">
        {isNegative && <span>-</span>}
        <span>$</span>
        <span>{number}</span>
      </span>
    );
  }

  const [main, cents] = number.split('.');

  return (
    <span className="inline-flex items-baseline">
      {isNegative && <span>-</span>}
      <span>$</span>
      <span>{main}</span>
      <span className="text-lg text-[var(--color-muted)] font-medium">.{cents}</span>
    </span>
  );
}

export default function SpendingVsEarningCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState('6');
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredData, setHoveredData] = useState(null);

  // Generate placeholder months with $0 values for empty state
  const generatePlaceholderMonths = (count) => {
    const now = new Date();
    const months = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      months.push({
        monthName: monthNames[d.getMonth()],
        monthNumber: d.getMonth() + 1,
        year: d.getFullYear(),
        earning: 0,
        spending: 0,
      });
    }
    return months;
  };

  // Fetch data (skipped when externalData is provided)
  useEffect(() => {
    if (externalData) {
      // Use data provided by parent (e.g. dashboard summary pre-fetch)
      const data = externalData.data || [];
      let monthsParam = selectedPeriod === 'ytd' ? (new Date().getMonth() + 1).toString() : selectedPeriod;
      setChartData(data.length > 0 ? data : generatePlaceholderMonths(parseInt(monthsParam) || 6));
      setIsLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user?.id) { setIsLoading(false); return; }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Determine months parameter based on selectedPeriod
        let monthsParam = selectedPeriod;
        if (selectedPeriod === 'ytd') {
          const currentMonth = new Date().getMonth(); // 0-indexed
          monthsParam = (currentMonth + 1).toString(); // Convert to 1-indexed month count
        }

        const response = await authFetch(`/api/transactions/spending-earning?months=${monthsParam}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        const data = result.data || [];
        // If no data returned, show placeholder months so chart renders with labels
        setChartData(data.length > 0 ? data : generatePlaceholderMonths(parseInt(monthsParam) || 6));
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [authLoading, user?.id, selectedPeriod, externalData]);

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

  // Calculate average monthly cashflow (net gain/loss)
  const { averageCashflow, monthCount, hasTransactions } = useMemo(() => {
    if (!chartData.length) return { averageCashflow: 0, monthCount: 0, hasTransactions: false };
    const totalEarning = chartData.reduce((acc, curr) => acc + (curr.earning || 0), 0);
    const totalSpendingAmt = chartData.reduce((acc, curr) => acc + Math.abs(curr.spending || 0), 0);
    const hasAny = totalEarning > 0 || totalSpendingAmt > 0;
    const totalNet = chartData.reduce((acc, curr) => {
      return acc + ((curr.earning || 0) - (curr.spending || 0));
    }, 0);
    return {
      averageCashflow: hasAny ? totalNet / chartData.length : 0,
      monthCount: hasAny ? chartData.length : 0,
      hasTransactions: hasAny,
    };
  }, [chartData]);

  const isPositiveCashflow = averageCashflow >= 0;

  return (
    <div className="h-full relative" style={{ zIndex: hoveredData ? 100 : 'auto' }}>
      {showLoading && (
        <div className="absolute inset-0 z-20 animate-pulse pointer-events-none flex flex-col pt-0 pb-0">
          {/* Header row — matches actual layout */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="h-4 bg-[var(--color-border)] rounded w-36 mb-3" />
              <div className="h-8 bg-[var(--color-border)] rounded w-28 mb-2" />
              <div className="h-3 bg-[var(--color-border)] rounded w-24" />
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="h-7 bg-[var(--color-border)] rounded w-24" />
              <div className="flex gap-4">
                <div className="h-3 bg-[var(--color-border)] rounded w-14" />
                <div className="h-3 bg-[var(--color-border)] rounded w-16" />
              </div>
            </div>
          </div>
          {/* Chart area */}
          <div className="flex-1 bg-[var(--color-border)] rounded opacity-30 mt-2" />
        </div>
      )}

      <div className={`h-full flex flex-col ${showLoading ? 'opacity-0' : ''}`}>
        {/* Custom Header */}
        <div className="px-0 pt-0 pb-2 shrink-0">
          <div className="flex items-start justify-between gap-2">
            {/* Title and Values */}
            <div className="min-w-0">
              <div className="card-header mb-1">
                Avg. Monthly Cashflow
              </div>

              <div className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--color-fg)] mb-1 sm:mb-2">
                <span>{isPositiveCashflow ? '+' : ''}</span>
                <AnimatedCounter value={averageCashflow} showCents={false} />
              </div>

            </div>

            {/* Right Side Actions */}
            <div className="flex flex-col items-end gap-2 sm:gap-3 shrink-0">
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

        {/* Time Range Selector */}
        <div className="mt-2 pt-2 border-t border-[var(--color-border)]/50 -mx-5 px-5">
          <TimeRangeSelector
            ranges={['6M', '1Y', 'YTD']}
            activeRange={selectedPeriod === '6' ? '6M' : selectedPeriod === '12' ? '1Y' : 'YTD'}
            onRangeChange={(range) => {
              const map = { '6M': '6', '1Y': '12', 'YTD': 'ytd' };
              setSelectedPeriod(map[range] || '6');
            }}
            layoutId="cashflowTimeRange"
          />
        </div>
      </div>
    </div>
  );
}
