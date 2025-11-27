import React, { useMemo } from "react";
import Card from "../ui/Card";
import LineChart from "../ui/LineChart";

export default function MonthlyOverviewCard() {
  const [activeIndex, setActiveIndex] = React.useState(null);

  // Generate dummy data for the chart
  const chartData = useMemo(() => {
    const data = [];
    const days = 30;
    let currentIncome = 5000;
    let currentSpending = 2000;

    for (let i = 1; i <= days; i++) {
      // Add some randomness
      const incomeChange = (Math.random() - 0.5) * 1000;
      currentIncome = Math.max(3000, currentIncome + incomeChange);

      const spendingChange = (Math.random() - 0.5) * 500;
      currentSpending = Math.max(1000, currentSpending + spendingChange);

      data.push({
        dateString: `Nov ${i}`,
        income: Math.round(currentIncome),
        spending: Math.round(currentSpending),
      });
    }
    return data;
  }, []);

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

  const Legend = (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
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
      <div className="h-4 w-px bg-[var(--color-border)]" />
      <div className="text-xs text-[var(--color-muted)] font-medium min-w-[60px] text-right">
        {currentData?.dateString || 'Total'}
      </div>
    </div>
  );

  return (
    <Card title="Monthly Overview" action={Legend} padding="none">
      <div className="mb-6 px-5">
        <div className="flex items-baseline gap-4">
          <div className={!isIncomeHigher ? "opacity-50" : ""}>
            <div className={`${isIncomeHigher ? "text-2xl" : "text-lg"} font-medium tracking-tight text-[var(--color-fg)]`}>
              {formatCurrency(currentData?.income || 0)}
            </div>
            <div className="text-xs text-[var(--color-muted)]">Income</div>
          </div>
          <div className={isIncomeHigher ? "opacity-50" : ""}>
            <div className={`${!isIncomeHigher ? "text-2xl" : "text-lg"} font-medium tracking-tight text-[var(--color-fg)]`}>
              {formatCurrency(currentData?.spending || 0)}
            </div>
            <div className="text-xs text-[var(--color-muted)]">Spending</div>
          </div>
        </div>
      </div>

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
    </Card>
  );
}
