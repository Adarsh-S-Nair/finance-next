"use client";

import React from "react";

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CustomDonut({ data, size = 160, strokeWidth = 20, showTotal = true }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let cumulativePercentage = 0;
  
  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercentage * circumference / 100;
    
    cumulativePercentage += percentage;
    
    return {
      ...item,
      percentage,
      strokeDasharray,
      strokeDashoffset,
      index
    };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        
        {/* Data segments */}
        {segments.map((segment) => (
          <circle
            key={segment.index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={segment.strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        ))}
      </svg>
      
      {/* Center content */}
      {showTotal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-semibold text-[var(--color-fg)]">
            {formatCurrency(total)}
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            Total Spent
          </div>
        </div>
      )}
    </div>
  );
}
