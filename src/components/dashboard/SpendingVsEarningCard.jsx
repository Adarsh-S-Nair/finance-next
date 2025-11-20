"use client";

import React from "react";
import Card from "../ui/Card";
import SpendingEarningChart from "./SpendingEarningChart";
import { useUser } from "../UserProvider";
import { useNetWorth } from "../NetWorthProvider";

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SpendingVsEarningCard() {
  const { profile } = useUser();
  const { currentNetWorth, loading: netWorthLoading } = useNetWorth();
  
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
    <Card width="full" className="flex flex-col h-full" variant="glass">
      <div className="mb-4 md:mb-6">
        <div className="text-sm text-[var(--color-muted)] font-light uppercase tracking-wider">Balance</div>
        {!netWorthLoading && currentNetWorth && (
          <div className="text-xl md:text-3xl font-medium text-[var(--color-fg)] mt-1">
            {formatCurrency(currentNetWorth.netWorth || 0)}
          </div>
        )}
        {netWorthLoading && (
          <div className="h-6 md:h-8 bg-[var(--color-border)] rounded w-24 md:w-32 mt-1 animate-pulse" />
        )}
      </div>
      
      <div className="flex-1 min-h-0">
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
