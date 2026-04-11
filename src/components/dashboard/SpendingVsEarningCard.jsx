"use client";

import React, { useState, useMemo, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import SpendingEarningChart from "./SpendingEarningChartV2";
import { useUser } from "../providers/UserProvider";
import TimeRangeSelector from "../ui/TimeRangeSelector";
import { useRouter } from "next/navigation";
import { CurrencyAmount } from "../../lib/formatCurrency";

export default function SpendingVsEarningCard({ data: externalData } = {}) {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState('6');
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredData, setHoveredData] = useState(null);

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

  useEffect(() => {
    if (externalData) {
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
        let monthsParam = selectedPeriod;
        if (selectedPeriod === 'ytd') {
          const currentMonth = new Date().getMonth();
          monthsParam = (currentMonth + 1).toString();
        }

        const response = await authFetch(`/api/transactions/spending-earning?months=${monthsParam}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const result = await response.json();
        const data = result.data || [];
        setChartData(data.length > 0 ? data : generatePlaceholderMonths(parseInt(monthsParam) || 6));
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [authLoading, user?.id, selectedPeriod, externalData]);

  const handleSelectMonth = (data) => {
    if (!data) return;
    const { year, monthNumber } = data;
    const monthStr = String(monthNumber).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const params = new URLSearchParams({ dateRange: 'custom', startDate, endDate });
    router.push(`/transactions?${params.toString()}`);
  };

  const { averageCashflow } = useMemo(() => {
    if (!chartData.length) return { averageCashflow: 0 };
    const totalEarning = chartData.reduce((acc, curr) => acc + (curr.earning || 0), 0);
    const totalSpendingAmt = chartData.reduce((acc, curr) => acc + Math.abs(curr.spending || 0), 0);
    const hasAny = totalEarning > 0 || totalSpendingAmt > 0;
    const totalNet = chartData.reduce((acc, curr) => {
      return acc + ((curr.earning || 0) - (curr.spending || 0));
    }, 0);
    return {
      averageCashflow: hasAny ? totalNet / chartData.length : 0,
    };
  }, [chartData]);

  // Hovered month or total averages
  const displayIncome = hoveredData?.earning ?? null;
  const displaySpending = hoveredData?.spending ?? null;

  const isPositiveCashflow = averageCashflow >= 0;
  const showLoading = isLoading;

  return (
    <div className="h-full relative" style={{ zIndex: hoveredData ? 100 : 'auto' }}>
      {showLoading && (
        <div className="absolute inset-0 z-20 animate-pulse pointer-events-none flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="h-3 w-32 bg-[var(--color-border)] rounded" />
          </div>
          <div className="mb-4">
            <div className="h-8 w-28 bg-[var(--color-border)] rounded mb-2" />
            <div className="flex gap-6">
              <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
              <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
            </div>
          </div>
          <div className="flex-1 bg-[var(--color-border)] rounded opacity-30" />
        </div>
      )}

      <div className={`h-full flex flex-col ${showLoading ? 'opacity-0' : ''}`}>
        {/* Header */}
        <div className="shrink-0 mb-4 relative">
          <div className="card-header mb-4">
            Avg. Monthly Cashflow
          </div>

          {/* Hero number */}
          <div className="text-2xl sm:text-3xl font-medium tracking-tight text-[var(--color-fg)]">
            <span>{isPositiveCashflow ? '+' : ''}</span>
            <CurrencyAmount amount={averageCashflow} />
          </div>

          {/* Income / Spending breakdown on hover — positioned top-right */}
          {hoveredData && (
            <div className="absolute top-0 right-0 flex flex-col items-end gap-0.5 text-[11px] animate-fade-in">
              <div className="flex items-center gap-1 text-[var(--color-muted)]">
                <span className="tabular-nums font-medium text-[var(--color-fg)]"><CurrencyAmount amount={displayIncome} /></span>
                <span>in</span>
              </div>
              <div className="flex items-center gap-1 text-[var(--color-muted)]">
                <span className="tabular-nums font-medium text-[var(--color-fg)]"><CurrencyAmount amount={displaySpending} /></span>
                <span>out</span>
              </div>
            </div>
          )}
        </div>

        {/* Chart */}
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
