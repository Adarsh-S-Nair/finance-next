"use client";

import React from "react";
import Card from "../ui/Card";
import SpendingEarningChart from "./SpendingEarningChart";

export default function SpendingVsEarningCard() {
  // Mock data for the chart
  const chartData = [
    { 
      id: 'Income', 
      data: [
        { x: 'Jan', y: 4200 }, 
        { x: 'Feb', y: 3800 }, 
        { x: 'Mar', y: 4500 }, 
        { x: 'Apr', y: 4100 }, 
        { x: 'May', y: 4800 }, 
        { x: 'Jun', y: 5200 }
      ] 
    },
    { 
      id: 'Spending', 
      data: [
        { x: 'Jan', y: -3200 }, 
        { x: 'Feb', y: -2900 }, 
        { x: 'Mar', y: -3500 }, 
        { x: 'Apr', y: -3100 }, 
        { x: 'May', y: -3800 }, 
        { x: 'Jun', y: -4200 }
      ] 
    }
  ];

  return (
    <Card width="2/3">
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">Spending vs Earning</div>
      </div>
      
      <div className="h-48">
        <SpendingEarningChart 
          series={chartData}
          onSelectMonth={(data) => {
            console.log('Selected month:', data);
          }}
        />
      </div>
    </Card>
  );
}
