"use client";

import React, { useState, useMemo, useEffect } from "react";
import Card from "../ui/Card";
import SpendingEarningChart from "./SpendingEarningChart";
import Dropdown from "../ui/Dropdown";
import { useUser } from "../UserProvider";

export default function SpendingVsEarningCard() {
  const { user } = useUser();
  const [selectedPeriod, setSelectedPeriod] = useState('6');
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const isIncomeHigher = totalIncome >= totalSpending;

  return (
    <Card padding="none" className="h-full">
      {/* Custom Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          {/* Title and Values */}
          <div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Cashflow
            </div>

            <div className="flex items-baseline gap-4">
              <div className={!isIncomeHigher ? "opacity-65" : ""}>
                <div className={`${isIncomeHigher ? "text-2xl" : "text-lg"} font-medium tracking-tight text-[var(--color-fg)]`}>
                  {isLoading ? "..." : formatCurrency(totalIncome)}
                </div>
                <div className="text-xs text-[var(--color-fg)]">Income</div>
              </div>
              <div className={isIncomeHigher ? "opacity-75" : ""}>
                <div className={`${!isIncomeHigher ? "text-2xl" : "text-lg"} font-medium tracking-tight text-[var(--color-fg)]`}>
                  {isLoading ? "..." : formatCurrency(totalSpending)}
                </div>
                <div className="text-xs text-[var(--color-fg)]">Spending</div>
              </div>
            </div>
          </div>

          {/* Dropdown and Legend stacked */}
          <div className="flex flex-col items-end gap-3">
            <Dropdown
              label={periodOptions.find(p => p.value === selectedPeriod)?.label || "6 Months"}
              size="sm"
              items={periodOptions.map(period => ({
                label: period.label,
                onClick: () => setSelectedPeriod(period.value)
              }))}
              align="right"
            />

            {/* Legend with circles */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                <span className="text-xs text-[var(--color-muted)]">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--color-chart-expense)]" />
                <span className="text-xs text-[var(--color-muted)]">Spending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <SpendingEarningChart
          data={chartData}
          onSelectMonth={(data) => {
            console.log('Selected month:', data);
          }}
        />
      </div>
    </Card>
  );
}
