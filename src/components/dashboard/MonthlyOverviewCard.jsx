import React, { useState, useMemo, useEffect } from "react";
import Card from "../ui/Card";
import LineChart from "../ui/LineChart";
import Dropdown from "../ui/Dropdown";
import { useUser } from "../UserProvider";



export default function MonthlyOverviewCard() {
  const [activeIndex, setActiveIndex] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const { user } = useUser();

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

        // Set current month as default
        if (result.months && result.months.length > 0) {
          setSelectedMonth(result.months[0].value); // First item is current month (sorted newest first)
        }
      } catch (error) {
        console.error("Error fetching available months:", error);
      }
    };

    fetchAvailableMonths();
  }, [user?.id]);

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

  return (
    <Card padding="none" className={`relative overflow-hidden ${showLoading ? 'bg-zinc-100 dark:bg-zinc-900/50' : ''}`}>
      {showLoading && (
        <div className="absolute inset-0 z-20 shimmer pointer-events-none" />
      )}

      <div className={showLoading ? 'opacity-0' : ''}>
        {/* Custom Header */}
        <div className="px-5 pt-5">
          {/* Title Row - Date and Dropdown */}
          <div className="flex items-start justify-between">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Monthly Overview
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[var(--color-muted)] font-medium">
                {currentData?.dateString || 'Nov 30'}
              </div>
              <div className="h-3 w-px bg-[var(--color-border)]" />
              <Dropdown
                label={availableMonths.find(m => m.value === selectedMonth)?.label || "Select Month"}
                size="sm"
                items={availableMonths.map(month => ({
                  label: month.label,
                  onClick: () => setSelectedMonth(month.value)
                }))}
                align="right"
              />
            </div>
          </div>

          {/* Income/Spending Values and Legend Row */}
          <div className="flex items-baseline justify-between pb-6">
            {/* Values */}
            <div className="flex items-baseline gap-4">
              <div className={!isIncomeHigher ? "opacity-65" : ""}>
                <div className={`${isIncomeHigher ? "text-2xl" : "text-lg"} font-medium tracking-tight text-[var(--color-fg)]`}>
                  {formatCurrency(currentData?.income || 0)}
                </div>
                <div className="text-xs text-[var(--color-fg)]">Income</div>
              </div>
              <div className={isIncomeHigher ? "opacity-75" : ""}>
                <div className={`${!isIncomeHigher ? "text-2xl" : "text-lg"} font-medium tracking-tight text-[var(--color-fg)]`}>
                  {formatCurrency(currentData?.spending || 0)}
                </div>
                <div className="text-xs text-[var(--color-fg)]">Spending</div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <svg width="12" height="2" className="overflow-visible">
                  <line x1="0" y1="1" x2="12" y2="1" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-[var(--color-muted)]">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="12" height="2" className="overflow-visible">
                  <line x1="0" y1="1" x2="12" y2="1" stroke="var(--color-chart-expense)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-[var(--color-muted)]">Spending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 w-full" onMouseLeave={handleMouseLeave}>
          <LineChart
            data={chartData}
            width="100%"
            height="100%"
            margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
            lines={[
              {
                dataKey: "income",
                strokeColor: "var(--color-accent)",
                strokeWidth: 2,
                strokeOpacity: 0.8,
                showArea: true,
                areaOpacity: 0.1,
                gradientId: "monthlyOverviewIncome"
              },
              {
                dataKey: "spending",
                strokeColor: "var(--color-chart-expense)",
                strokeWidth: 2,
                strokeOpacity: 0.8,
                strokeDasharray: "4 4",
                showArea: true,
                areaOpacity: 0.1,
                gradientId: "monthlyOverviewSpending"
              }
            ]}
            showDots={false}
            curveType="monotone"
            xAxisDataKey="dateString"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </div>
      </div>
    </Card>
  );
}
