import React, { useState, useMemo, useEffect } from "react";
import { authFetch } from "../../lib/api/fetch";
import Card from "../ui/Card";
import LineChart from "../ui/LineChart";
import Dropdown from "../ui/Dropdown";
import { useUser } from "../providers/UserProvider";

export default function MonthlyOverviewCard({ initialMonth, onBack }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  // Use initialMonth if provided, otherwise null (will be set to default later)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || null);
  const [previousMonthName, setPreviousMonthName] = useState("");

  const { user } = useUser();

  // Update selectedMonth if initialMonth changes (e.g. re-opening the card)
  useEffect(() => {
    if (initialMonth) {
      setSelectedMonth(initialMonth);
    }
  }, [initialMonth]);

  const isLoadingState = (!chartData.length && !selectedMonth); // Simplified loading logic, ideally track fetch state

  // We need a local loading state to track fetch
  const [isFetching, setIsFetching] = useState(true);

  // Generate placeholder chart data for current month (all $0 values)
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

  // Fetch available months
  useEffect(() => {
    const fetchAvailableMonths = async () => {
      if (!user?.id) return;
      try {
        const response = await authFetch(`/api/transactions/available-months`);
        if (!response.ok) throw new Error('Failed to fetch available months');
        const result = await response.json();
        const months = result.months || [];
        setAvailableMonths(months);

        // Set current month as default ONLY if no initialMonth was provided
        if (!initialMonth && months.length > 0) {
          setSelectedMonth(months[0].value); // First item is current month (sorted newest first)
        }
        // If no months available (fresh account), show placeholder chart with $0 values
        if (months.length === 0) {
          setChartData(generatePlaceholderChartData());
          setIsFetching(false);
        }
      } catch (error) {
        console.error("Error fetching available months:", error);
        setIsFetching(false);
      }
    };

    fetchAvailableMonths();
  }, [user?.id, initialMonth]);

  // Fetch data for selected month
  useEffect(() => {
    const fetchMonthlyData = async () => {
      if (!user?.id || !selectedMonth) return;

      setIsFetching(true);
      try {
        // Parse the month value (format: "YYYY-MM")
        const [year, month] = selectedMonth.split('-');
        const monthIndex = parseInt(month) - 1; // Convert to 0-indexed

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
  }, [user?.id, selectedMonth]);

  const handleMouseMove = (data, index) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  // Determine which data point to display (hovered or last with valid spending data)
  const lastValidDataPoint = useMemo(() => {
    // Find the last data point that has a non-null spending value
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i]?.spending !== null && chartData[i]?.spending !== undefined) {
        return chartData[i];
      }
    }
    return chartData[chartData.length - 1] || null;
  }, [chartData]);

  // Find the full previous month total (last non-null previousSpending value)
  const fullPreviousMonthSpending = useMemo(() => {
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i]?.previousSpending !== null && chartData[i]?.previousSpending !== undefined) {
        return chartData[i].previousSpending;
      }
    }
    return 0;
  }, [chartData]);

  // When hovering, use the hovered data point but fall back to lastValidDataPoint's spending
  // if the hovered point has null spending (future dates in current month)
  const currentData = useMemo(() => {
    if (activeIndex !== null && chartData[activeIndex]) {
      const hoveredPoint = chartData[activeIndex];
      // If hovering over a future date with null spending, use last valid spending value
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

  // Previous month spending: show full month total when not hovering, day-matched when hovering
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

  const showLoading = isFetching;

  // Dynamic Date Display


  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div className="flex flex-col h-full animate-pulse">
      <div className="px-6 pt-6">
        <div className="flex justify-between items-start mb-6">
          <div className="h-5 w-32 bg-[var(--color-border)] rounded" />
          <div className="h-5 w-24 bg-[var(--color-border)] rounded" />
        </div>
        <div className="flex gap-4 mb-6">
          <div>
            <div className="h-8 w-24 bg-[var(--color-border)] rounded mb-1" />
            <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
          </div>
          <div>
            <div className="h-8 w-24 bg-[var(--color-border)] rounded mb-1" />
            <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-[var(--color-border)] opacity-30 mt-4 mx-6 rounded-lg" />
    </div>
  );

  return (
    <Card padding="none" hover className="relative overflow-hidden h-full">
      {showLoading ? (
        <SkeletonLoader />
      ) : (
        <div className="flex flex-col h-full">
          {/* Custom Header */}
          {/* Custom Header */}
          <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-3 flex justify-between items-start">
            {/* Left Side: Title and Values */}
            <div>
              {/* Title */}
              <div
                className={`flex items-center gap-1 mb-3 sm:mb-4 ${onBack ? 'cursor-pointer group' : ''}`}
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
                  Monthly Overview
                </div>
              </div>

              {/* Values Row */}
              <div className="flex items-baseline gap-6 sm:gap-10">
                <div>
                  <div className="text-2xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] mb-1">
                    {formatCurrency(currentData?.spending || 0)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                    <span className="text-[10px] sm:text-xs font-medium text-[var(--color-muted)]">This Month</span>
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-4xl font-medium tracking-tight text-[var(--color-muted)]/50 mb-1">
                    {formatCurrency(displayPreviousSpending)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <span className="text-[10px] sm:text-xs font-medium text-[var(--color-muted)]">{previousMonthName || "Previous"}</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Side: Controls */}
            <div className="flex flex-col items-end gap-2">
              {/* Top Row: Date + Dropdown */}
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Dynamic Date Display - hidden on very small screens */}
                {currentData?.dateString && (
                  <span className="hidden sm:inline text-sm font-medium text-[var(--color-fg)]">
                    {currentData.dateString}
                  </span>
                )}

                {/* Month Dropdown */}
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
          </div>

          {/* Chart */}
          <div className="flex-1 w-full mt-4" onMouseLeave={handleMouseLeave}>
            <LineChart
              data={chartData}
              width="100%"
              height="100%"
              margin={{ top: 10, right: 16, bottom: 0, left: 16 }}
              lines={[
                {
                  dataKey: "previousSpending",
                  strokeColor: "var(--color-muted)",
                  strokeWidth: 2,
                  strokeOpacity: 0.4,
                  showArea: true,
                  areaOpacity: 0.05,
                  gradientId: "monthlyOverviewPrevious"
                },
                {
                  dataKey: "spending",
                  strokeColor: "var(--color-accent)",
                  strokeWidth: 2.5,
                  strokeOpacity: 1,
                  showArea: true,
                  areaOpacity: 0.1,
                  gradientId: "monthlyOverviewSpending"
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
              formatXAxis={(val) => val.split(' ')[1] || val} // Show day number if possible
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
