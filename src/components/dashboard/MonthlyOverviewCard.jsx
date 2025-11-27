import React, { useMemo } from "react";
import Card from "../ui/Card";
import LineChart from "../ui/LineChart";

export default function MonthlyOverviewCard() {
  const [activeIndex, setActiveIndex] = React.useState(null);

  // Generate dummy data for the chart
  const chartData = useMemo(() => {
    const data = [];
    const days = 30;
    let currentValue = 1000;

    for (let i = 1; i <= days; i++) {
      // Add some randomness to create a realistic looking spending curve
      const change = (Math.random() - 0.5) * 500;
      currentValue = Math.max(200, currentValue + change); // Ensure it stays positive

      data.push({
        dateString: `Nov ${i}`, // Using Nov for "current month" dummy data
        value: Math.round(currentValue),
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

  return (
    <Card title="Monthly Overview">
      <div className="mb-6">
        <div className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
          {formatCurrency(currentData?.value || 0)}
        </div>
        <div className="text-sm text-zinc-500">
          {currentData?.dateString || 'Total'}
        </div>
      </div>

      <div className="h-64 w-full" onMouseLeave={handleMouseLeave}>
        <LineChart
          data={chartData}
          dataKey="value"
          width="100%"
          height="100%"
          margin={{ top: 10, right: 10, bottom: 10, left: 10 }}


          showArea={true}
          areaOpacity={0.15}
          showDots={false}
          gradientId="monthlyOverviewGradient"
          curveType="monotone"
          xAxisDataKey="dateString"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </Card>
  );
}
