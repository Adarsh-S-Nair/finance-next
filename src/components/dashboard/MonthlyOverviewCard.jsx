import React, { useState, useMemo, useEffect } from "react";
import Card from "../ui/Card";
import LineChart from "../ui/LineChart";
import Dropdown from "../ui/Dropdown";
import { useUser } from "../UserProvider";

export default function MonthlyOverviewCard({ initialMonth, onBack }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  // Use initialMonth if provided, otherwise null (will be set to default later)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || null);

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

  // Fetch available months
  useEffect(() => {
    const fetchAvailableMonths = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`/api/transactions/available-months?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch available months');
        const result = await response.json();
        setAvailableMonths(result.months || []);

        // Set current month as default ONLY if no initialMonth was provided
        if (!initialMonth && result.months && result.months.length > 0) {
          setSelectedMonth(result.months[0].value); // First item is current month (sorted newest first)
        }
      } catch (error) {
        console.error("Error fetching available months:", error);
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

        const response = await fetch(
          `/api/transactions/monthly-overview?userId=${user.id}&month=${monthIndex}&year=${year}`
        );

        if (!response.ok) throw new Error('Failed to fetch monthly overview data');
        const result = await response.json();
        setChartData(result.data);
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

  // Determine which data point to display (hovered or last)
  const currentData = activeIndex !== null ? chartData[activeIndex] : chartData[chartData.length - 1];

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isIncomeHigher = (currentData?.income || 0) >= (currentData?.spending || 0);
  const showLoading = isFetching;

  // Dynamic Date Display


  // Skeleton Loader Component
  const SkeletonLoader = () => (
    <div className="flex flex-col h-full animate-pulse">
      <div className="px-6 pt-6">
        <div className="flex justify-between items-start mb-6">
          <div className="h-5 w-32 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
          <div className="h-5 w-24 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
        </div>
        <div className="flex gap-4 mb-6">
          <div>
            <div className="h-8 w-24 bg-zinc-100 dark:bg-zinc-800/50 rounded mb-1" />
            <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
          </div>
          <div>
            <div className="h-8 w-24 bg-zinc-100 dark:bg-zinc-800/50 rounded mb-1" />
            <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-zinc-50 dark:bg-zinc-900/30 mt-4 mx-6 rounded-lg" />
    </div>
  );

  return (
    <Card padding="none" className="relative overflow-hidden h-full">
      {showLoading ? (
        <SkeletonLoader />
      ) : (
        <div className="flex flex-col h-full">
          {/* Custom Header */}
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-start justify-between">
              {/* Left Side: Title and Values */}
              <div>
                {/* Title */}
                <div
                  className={`flex items-center gap-2 mb-1 ${onBack ? 'cursor-pointer group' : ''}`}
                  onClick={onBack}
                >
                  {onBack && (
                    <div className="p-1 -ml-2 transition-colors text-[var(--color-muted)] group-hover:text-[var(--color-fg)]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                    </div>
                  )}
                  <div className={`text-base font-normal text-[var(--color-fg)] ${onBack ? 'group-hover:text-[var(--color-fg)] transition-colors' : ''}`}>
                    Monthly Overview
                  </div>
                </div>

                {/* Values Row */}
                <div className="flex items-baseline gap-8">
                  <div>
                    <div className="text-3xl font-medium tracking-tight text-[var(--color-fg)] mb-1">
                      {formatCurrency(currentData?.income || 0)}
                    </div>
                    <div className="text-xs font-medium text-[var(--color-muted)]">Income</div>
                  </div>
                  <div>
                    <div className="text-3xl font-medium tracking-tight text-[var(--color-fg)] mb-1">
                      {formatCurrency(currentData?.spending || 0)}
                    </div>
                    <div className="text-xs font-medium text-[var(--color-muted)]">Spending</div>
                  </div>
                </div>
              </div>

              {/* Right Side: Month Selector and Legend */}
              <div className="flex flex-col items-end gap-2">
                {/* Date and Month Dropdown */}
                <div className="flex items-center gap-3">
                  {/* Dynamic Date Display */}
                  {currentData?.dateString && (
                    <span className="text-sm font-medium text-[var(--color-fg)]">
                      {currentData.dateString}
                    </span>
                  )}
                  {/* Month Dropdown */}
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
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4">
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

          {/* Chart */}
          <div className="h-64 w-full mt-4" onMouseLeave={handleMouseLeave}>
            <LineChart
              data={chartData}
              width="100%"
              height="100%"
              margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
              lines={[
                {
                  dataKey: "income",
                  strokeColor: "var(--color-cashflow-income)",
                  strokeWidth: 2,
                  strokeOpacity: 1,
                  showArea: true,
                  areaOpacity: 0.1,
                  gradientId: "monthlyOverviewIncome"
                },
                {
                  dataKey: "spending",
                  strokeColor: "var(--color-cashflow-spending)",
                  strokeWidth: 2,
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
