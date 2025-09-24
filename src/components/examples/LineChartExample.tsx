"use client";

import React, { useState, useEffect } from 'react';
import LineChart from '../ui/LineChart';
import Card from '../ui/Card';

// Example data generator
const generateSampleData = (points: number = 12) => {
  const data = [];
  const baseValue = 1000;
  const now = new Date();
  
  for (let i = 0; i < points; i++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - (points - 1 - i));
    
    // Generate some realistic variation
    const variation = (Math.random() - 0.5) * 200;
    const trend = i * 50; // Slight upward trend
    const value = baseValue + variation + trend;
    
    data.push({
      month: date.toLocaleString('en-US', { month: 'short' }),
      value: Math.max(0, value),
      date: date.toISOString().split('T')[0]
    });
  }
  
  return data;
};

export default function LineChartExample() {
  const [data, setData] = useState([]);
  const [hoveredData, setHoveredData] = useState(null);

  useEffect(() => {
    setData(generateSampleData());
  }, []);

  const handleMouseMove = (data: any, index: number) => {
    setHoveredData({ data, index });
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const CustomTooltip = (data: any, index: number) => {
    return (
      <div className="text-center">
        <div className="font-semibold">{formatCurrency(data.value)}</div>
        <div className="text-xs text-[var(--color-muted)]">
          {data.month}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4">Basic Line Chart (Dots on Hover)</h3>
        <LineChart
          data={data}
          dataKey="value"
          width="100%"
          height={200}
          strokeColor="var(--color-accent)"
          strokeWidth={2}
          showDots={false}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {hoveredData && (
          <div className="mt-2 text-sm text-[var(--color-muted)]">
            Hovering: {formatCurrency(hoveredData.data.value)} in {hoveredData.data.month}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Area Chart with Grid</h3>
        <LineChart
          data={data}
          dataKey="value"
          width="100%"
          height={200}
          strokeColor="#3b82f6"
          strokeWidth={3}
          showArea={true}
          areaOpacity={0.2}
          showDots={false}
          showGrid={true}
          gridColor="var(--color-border)"
          curveType="monotone"
        />
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Step Chart</h3>
        <LineChart
          data={data}
          dataKey="value"
          width="100%"
          height={200}
          strokeColor="#10b981"
          strokeWidth={2}
          showDots={false}
          dotColor="#10b981"
          dotRadius={2}
          curveType="step"
        />
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Chart with Tooltip</h3>
        <LineChart
          data={data}
          dataKey="value"
          width="100%"
          height={200}
          strokeColor="#8b5cf6"
          strokeWidth={2}
          showDots={false}
          showTooltip={true}
          tooltip={CustomTooltip}
        />
      </Card>
    </div>
  );
}
