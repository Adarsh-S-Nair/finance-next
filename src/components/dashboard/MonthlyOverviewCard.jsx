import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { authFetch } from "../../lib/api/fetch";
import LineChart from "../ui/LineChart";
import { Dropdown } from "@slate-ui/react";
import { useUser } from "../providers/UserProvider";
import { CurrencyAmount } from "../../lib/formatCurrency";
import DynamicIcon from "../DynamicIcon";
import { FiTag } from "react-icons/fi";

export default function MonthlyOverviewCard({ initialMonth, onBack, mockData }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [chartData, setChartData] = useState(mockData?.chartData || []);
  const [availableMonths, setAvailableMonths] = useState(mockData?.availableMonths || []);
  const [selectedMonth, setSelectedMonth] = useState(
    mockData?.selectedMonth || initialMonth || null
  );
  const [previousMonthName, setPreviousMonthName] = useState(mockData?.previousMonthName || "");

  const { user, loading: authLoading } = useUser();

  useEffect(() => {
    if (mockData) return;
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth, mockData]);

  const [isFetching, setIsFetching] = useState(!mockData);

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

  useEffect(() => {
    if (mockData) {
      setAvailableMonths(mockData.availableMonths || []);
      setSelectedMonth(mockData.selectedMonth || null);
      setIsFetching(false);
      return;
    }
    if (authLoading) return;
    if (!user?.id) { setIsFetching(false); return; }
    let cancelled = false;
    const fetchAvailableMonths = async (retries = 2) => {
      setIsFetching(true);
      try {
        const response = await authFetch(`/api/transactions/available-months`);
        if (!response.ok) throw new Error('Failed to fetch available months');
        if (cancelled) return;
        const result = await response.json();
        const months = result.months || [];
        setAvailableMonths(months);

        if (!initialMonth && months.length > 0) {
          setSelectedMonth(months[0].value);
        }
        if (months.length === 0) {
          setChartData(generatePlaceholderChartData());
          setIsFetching(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching available months:", error);
        if (retries > 0) {
          setTimeout(() => { if (!cancelled) fetchAvailableMonths(retries - 1); }, 1500);
          return;
        }
        setIsFetching(false);
      }
    };

    fetchAvailableMonths();
    return () => { cancelled = true; };
  }, [authLoading, user?.id, initialMonth, mockData]);

  useEffect(() => {
    if (mockData) {
      setChartData(mockData.chartData || []);
      setPreviousMonthName(mockData.previousMonthName || "");
      setIsFetching(false);
      return;
    }
    if (authLoading) return;
    if (!user?.id) { setIsFetching(false); return; }
    const fetchMonthlyData = async () => {
      if (!selectedMonth) return;

      setIsFetching(true);
      try {
        const [year, month] = selectedMonth.split('-');
        const monthIndex = parseInt(month) - 1;

        const response = await authFetch(
          `/api/transactions/monthly-overview?month=${monthIndex}&year=${year}`
        );

        if (!response.ok) throw new Error('Failed to fetch monthly overview data');
        const result = await response.json();
        setChartData(result.data);
        setPreviousMonthName(result.previousMonthName || "");
      } catch (error) {
        console.error("Error fetching monthly overview:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchMonthlyData();
  }, [authLoading, user?.id, selectedMonth, mockData]);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

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
  const lastTooltipData = useRef(null);
  const lastTooltipStyle = useRef({});
  if (hoveredDayTransactions) {
    lastTooltipData.current = hoveredDayTransactions;
  }

  const isTooltipVisible = !!hoveredDayTransactions;
  const tooltipData = hoveredDayTransactions || lastTooltipData.current;

  const tooltipStyle = useMemo(() => {
    if (activeIndex === null || !chartData.length) return {};
    const pct = (activeIndex / Math.max(chartData.length - 1, 1)) * 100;
    // Clamp and adjust transform so tooltip stays within bounds
    if (pct < 20) {
      return { left: `${Math.max(2, pct)}%`, transform: 'translateX(0)' };
    } else if (pct > 80) {
      return { left: `${Math.min(98, pct)}%`, transform: 'translateX(-100%)' };
    }
    return { left: `${pct}%`, transform: 'translateX(-50%)' };
  }, [activeIndex, chartData.length]);

  // Cache tooltip position for exit animation
  if (Object.keys(tooltipStyle).length > 0) {
    lastTooltipStyle.current = tooltipStyle;
  }
  const displayTooltipStyle = Object.keys(tooltipStyle).length > 0 ? tooltipStyle : lastTooltipStyle.current;

  const showLoading = isFetching;

  const selectedMonthName = useMemo(() => {
    if (!selectedMonth) return '';
    const [y, m] = selectedMonth.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  }, [selectedMonth]);

  const SkeletonLoader = () => (
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
              {activeIndex !== null && currentData?.dateString && (
                <span className="text-[11px] font-medium text-[var(--color-muted)] animate-fade-in">
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
                  strokeWidth: 2,
                  strokeOpacity: 1,
                  showArea: true,
                  areaOpacity: 0.06,
                  gradientId: "monthlyOverviewSpending",
                }
              ]}
              showDots={false}
              curveType="monotone"
              xAxisDataKey="dateString"
              showXAxis={true}
              showYAxis={false}
              showGrid={false}
              xAxisInterval={4}
              formatYAxis={(val) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(val)}
              formatXAxis={(val) => val.split(' ')[1] || val}
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
                <div className="bg-zinc-900 dark:bg-zinc-800 rounded-md px-3 py-2.5 min-w-[180px] max-w-[260px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
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
                        <span className="text-[12px] text-zinc-200 truncate flex-1">{tx.merchant}</span>
                        <span className="text-[12px] text-zinc-400 tabular-nums flex-shrink-0">
                          {formatCurrency(tx.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {tooltipData.moreCount > 0 && (
                    <p className="text-[10px] text-zinc-500 mt-2">
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
