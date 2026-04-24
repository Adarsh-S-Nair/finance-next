import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { useUser } from "../providers/UserProvider";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";
import DynamicIcon from "../DynamicIcon";
import { FiTag } from "react-icons/fi";
import { Dropdown } from "@zervo/ui";
import { LineChart } from "@zervo/ui";

function SkeletonLoader() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-3 w-28 bg-[var(--color-border)] rounded" />
        <div className="h-7 w-24 bg-[var(--color-border)] rounded" />
      </div>
      <div className="flex items-start gap-8 mb-6">
        <div>
          <div className="h-9 w-28 bg-[var(--color-border)] rounded mb-2" />
          <div className="h-3 w-16 bg-[var(--color-border)] rounded" />
        </div>
        <div>
          <div className="h-9 w-24 bg-[var(--color-border)] rounded mb-2" />
          <div className="h-3 w-14 bg-[var(--color-border)] rounded" />
        </div>
      </div>
      <div className="flex-1 w-full bg-[var(--color-border)] opacity-30 rounded-lg" />
    </div>
  );
}

export default function MonthlyOverviewCard({ initialMonth, onBack, mockData }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(
    mockData?.selectedMonth || initialMonth || null,
  );

  const { user, loading: authLoading } = useUser();

  useEffect(() => {
    if (mockData) return;
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth, mockData]);

  const generatePlaceholderChartData = () => {
    const now = new Date();
    const month = now.getMonth();
    const today = now.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Array.from({ length: Math.max(today, 1) }, (_, i) => ({
      dateString: `${monthNames[month]} ${i + 1}`,
      spending: 0,
      previousSpending: 0,
    }));
  };

  // Available months — cached so the month dropdown is instant on
  // re-visit. Queries are disabled when mock data is provided so the
  // storybook preview doesn't fire real network calls.
  const useQueries = !mockData && !authLoading && !!user?.id;
  const { data: monthsData } = useAuthedQuery(
    ['monthly-overview:available-months', user?.id],
    useQueries ? '/api/transactions/available-months' : null,
  );
  const availableMonths = mockData?.availableMonths ?? monthsData?.months ?? [];

  // Pick the newest month once the list arrives (unless an explicit
  // initialMonth was passed in).
  useEffect(() => {
    if (mockData || initialMonth || selectedMonth) return;
    if (availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0].value);
    }
  }, [availableMonths, initialMonth, mockData, selectedMonth]);

  // Monthly chart data for the selected month. Each month gets its
  // own cache key so switching months still lands instantly once
  // seen.
  const [selectedYear, selectedMonthIdx] = useMemo(() => {
    if (!selectedMonth) return [null, null];
    const [y, m] = selectedMonth.split('-');
    return [y, parseInt(m, 10) - 1];
  }, [selectedMonth]);

  const { data: monthlyData, isFetching: isMonthlyFetching } = useAuthedQuery(
    ['monthly-overview:month', user?.id, selectedMonth],
    useQueries && selectedMonth
      ? `/api/transactions/monthly-overview?month=${selectedMonthIdx}&year=${selectedYear}`
      : null,
  );
  const rawChartData = mockData?.chartData ?? monthlyData?.data ?? [];
  const previousMonthName =
    mockData?.previousMonthName ?? monthlyData?.previousMonthName ?? '';

  // If the user has no transactions yet the months endpoint returns
  // an empty list; fall back to a pace-only placeholder chart so the
  // card still has something to render.
  const placeholderChart = useMemo(() => {
    if (availableMonths.length > 0 || !useQueries) return null;
    return generatePlaceholderChartData();
  }, [availableMonths.length, useQueries]);
  const chartData =
    rawChartData.length > 0 ? rawChartData : placeholderChart ?? rawChartData;

  // Show the skeleton only while we genuinely haven't painted
  // anything yet. Once we have chart data (or a placeholder) we stay
  // on the rendered chart even during background refetches.
  const isFetching =
    mockData
      ? false
      : selectedMonth
        ? isMonthlyFetching && rawChartData.length === 0
        : availableMonths.length === 0 && !placeholderChart;

  const chartContainerRef = useRef(null);

  const handleMouseMove = useCallback((data, index) => {
    setActiveIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const lastValidDataPoint = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i]?.spending !== null && chartData[i]?.spending !== undefined) {
        return chartData[i];
      }
    }
    return chartData[chartData.length - 1] || null;
  }, [chartData]);

  const fullPreviousMonthSpending = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i]?.previousSpending !== null && chartData[i]?.previousSpending !== undefined) {
        return chartData[i].previousSpending;
      }
    }
    return 0;
  }, [chartData]);

  const currentData = useMemo(() => {
    if (activeIndex !== null && chartData[activeIndex]) {
      const hoveredPoint = chartData[activeIndex];
      if (hoveredPoint.spending === null || hoveredPoint.spending === undefined) {
        return {
          ...hoveredPoint,
          spending: lastValidDataPoint?.spending ?? 0,
        };
      }
      return hoveredPoint;
    }
    return lastValidDataPoint;
  }, [activeIndex, chartData, lastValidDataPoint]);

  const displayPreviousSpending = useMemo(() => {
    if (activeIndex !== null && chartData[activeIndex]) {
      return chartData[activeIndex]?.previousSpending ?? 0;
    }
    return fullPreviousMonthSpending;
  }, [activeIndex, chartData, fullPreviousMonthSpending]);

  const momComparison = useMemo(() => {
    const current = currentData?.spending || 0;
    const previous = displayPreviousSpending || 0;
    if (previous === 0 || current === 0) return null;

    const change = ((current - previous) / previous) * 100;
    const absChange = Math.abs(Math.round(change));
    if (absChange < 1) return null;

    return {
      percentage: absChange.toLocaleString('en-US'),
      direction: change > 0 ? 'up' : 'down',
    };
  }, [currentData?.spending, displayPreviousSpending]);

  const hoveredDayTransactions = useMemo(() => {
    if (activeIndex === null || !chartData[activeIndex]) return null;
    const point = chartData[activeIndex];
    if (!point.transactions || point.transactions.length === 0) return null;
    if (point.dailySpending === null || point.dailySpending === 0) return null;
    return {
      date: point.dateString,
      transactions: point.transactions,
      moreCount: point.moreCount || 0,
    };
  }, [activeIndex, chartData]);

  // Cache last tooltip data so it can render during exit animation
  const [cachedTooltip, setCachedTooltip] = useState({ data: null, style: {} });

  const isTooltipVisible = !!hoveredDayTransactions;

  const tooltipStyle = useMemo(() => {
    if (activeIndex === null || !chartData.length) return {};
    const pct = (activeIndex / Math.max(chartData.length - 1, 1)) * 100;
    if (pct < 20) {
      return { left: `${Math.max(2, pct)}%`, transform: 'translateX(0)' };
    } else if (pct > 80) {
      return { left: `${Math.min(98, pct)}%`, transform: 'translateX(-100%)' };
    }
    return { left: `${pct}%`, transform: 'translateX(-50%)' };
  }, [activeIndex, chartData.length]);

  useEffect(() => {
    if (hoveredDayTransactions) {
      setCachedTooltip({ data: hoveredDayTransactions, style: tooltipStyle });
    }
  }, [hoveredDayTransactions, tooltipStyle]);

  const tooltipData = hoveredDayTransactions || cachedTooltip.data;
  const displayTooltipStyle = Object.keys(tooltipStyle).length > 0 ? tooltipStyle : cachedTooltip.style;

  const showLoading = isFetching;

  const selectedMonthName = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  }, [selectedMonth]);

  return (
    <div className="relative h-full">
      {showLoading ? (
        <SkeletonLoader />
      ) : (
        <div className="flex flex-col h-full">
          {/* Header row: title + dropdown */}
          <div className="flex items-center justify-between mb-6">
            <div
              className={`flex items-center gap-1 ${onBack ? 'cursor-pointer group' : ''}`}
              onClick={onBack}
            >
              {onBack && (
                <div className="p-1 -ml-2 transition-colors text-[var(--color-muted)] group-hover:text-[var(--color-fg)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </div>
              )}
              <div className={`card-header ${onBack ? 'group-hover:text-[var(--color-fg)] transition-colors' : ''}`}>
                Monthly Spending
              </div>
            </div>

            <div className="flex items-center gap-3">
              {currentData?.dateString && (
                <span className="text-[11px] font-medium text-[var(--color-muted)]">
                  {currentData.dateString}
                </span>
              )}
              {availableMonths.length > 0 && (
                <Dropdown
                  label={availableMonths.find(m => m.value === selectedMonth)?.label || 'Select Month'}
                  items={availableMonths.map((month) => ({
                    label: month.label,
                    onClick: () => setSelectedMonth(month.value),
                    selected: month.value === selectedMonth
                  }))}
                  size="sm"
                  align="right"
                />
              )}
              {availableMonths.length === 0 && (
                <span className="text-xs text-[var(--color-muted)] px-2 py-1 border border-[var(--color-border)] rounded-md">
                  {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* Numbers side by side */}
          <div className="flex items-start gap-8 mb-6">
            {/* Current month */}
            <div>
              <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] mb-1.5">
                <CurrencyAmount amount={currentData?.spending || 0} />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-fg)]" />
                  <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                    {selectedMonthName || 'This month'}
                  </span>
                </div>
                {momComparison && (
                  <span className={`text-[11px] font-semibold ${
                    momComparison.direction === 'down'
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }`}>
                    {momComparison.direction === 'down' ? '▼' : '▲'} {momComparison.percentage}%
                  </span>
                )}
              </div>
            </div>

            {/* Previous month */}
            <div>
              <div className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-muted)] mb-1.5">
                <CurrencyAmount amount={displayPreviousSpending} />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-muted)]" />
                <span className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  {previousMonthName || 'Previous'}
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div ref={chartContainerRef} className="relative flex-1 w-full" onMouseLeave={handleMouseLeave}>
            <LineChart
              data={chartData}
              width="100%"
              height="100%"
              margin={{ top: 16, right: 16, bottom: 0, left: 16 }}
              lines={[
                {
                  dataKey: "previousSpending",
                  strokeColor: "var(--color-muted)",
                  strokeWidth: 1.5,
                  strokeOpacity: 1,
                  strokeDasharray: "4 4",
                  showArea: false,
                  gradientId: "monthlyOverviewPrevious"
                },
                {
                  dataKey: "spending",
                  strokeColor: "var(--color-fg)",
                  strokeWidth: 2.5,
                  strokeOpacity: 1,
                  showArea: true,
                  areaOpacity: 0.22,
                  gradientId: "monthlyOverviewSpending",
                }
              ]}
              showDots={false}
              curveType="monotone"
              xAxisDataKey="dateString"
              showXAxis={false}
              showYAxis={false}
              showGrid={false}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />

            {/* Transaction tooltip on hover — always mounted for exit animation */}
            {tooltipData && (
              <div
                className="absolute top-2 z-10 pointer-events-none"
                style={{
                  ...displayTooltipStyle,
                  opacity: isTooltipVisible ? 1 : 0,
                  scale: isTooltipVisible ? 1 : 0.85,
                  translateY: isTooltipVisible ? 0 : 8,
                  transition: 'opacity 0.25s ease, scale 0.35s cubic-bezier(0.34, 1.8, 0.64, 1), translate 0.35s cubic-bezier(0.34, 1.8, 0.64, 1)',
                }}
              >
                <div className="rounded-md bg-[var(--color-floating-bg)] ring-1 ring-[var(--color-floating-border)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] px-3 py-2.5 min-w-[180px] max-w-[260px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-floating-muted)] mb-2">
                    {tooltipData.date}
                  </p>
                  <ul className="space-y-2">
                    {tooltipData.transactions.map((tx, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: tx.icon_url ? 'transparent' : (tx.category_hex_color || '#71717a') }}
                        >
                          {tx.icon_url ? (
                            <img src={tx.icon_url} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <DynamicIcon
                              iconLib={tx.category_icon_lib}
                              iconName={tx.category_icon_name}
                              className="h-3 w-3 text-white"
                              fallback={FiTag}
                              style={{ strokeWidth: 2.5 }}
                            />
                          )}
                        </div>
                        <span className="text-[12px] text-[var(--color-floating-fg)] truncate flex-1">{tx.merchant}</span>
                        <span className="text-[12px] text-[var(--color-floating-muted)] tabular-nums flex-shrink-0">
                          {formatCurrency(tx.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {tooltipData.moreCount > 0 && (
                    <p className="text-[10px] text-[var(--color-floating-muted)] mt-2">
                      +{tooltipData.moreCount} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
