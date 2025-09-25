"use client";

import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';

export default function SpendingOverviewCard() {
  const { user } = useUser();
  const [spendingData, setSpendingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSpendingData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/transactions/spending-by-category?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch spending data');
        }
        
        const result = await response.json();
        // Sort by total_spent descending and take only top 5
        const sortedCategories = (result.categories || [])
          .sort((a, b) => b.total_spent - a.total_spent)
          .slice(0, 5);
        setSpendingData(sortedCategories);
        
      } catch (err) {
        console.error('Error fetching spending data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSpendingData();
  }, [user?.id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate total spending for segmented bar
  const totalSpending = spendingData.reduce((sum, item) => sum + item.total_spent, 0);


  if (loading) {
    return (
      <Card width="full" className="flex flex-col h-full">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
        </div>
        
        <div className="flex-1 flex flex-col space-y-3 md:space-y-5">
          <div className="h-3 md:h-4 rounded-full overflow-hidden">
            <div className="h-full flex gap-1">
              <div className="flex-1 bg-[var(--color-border)] rounded-full animate-pulse" />
              <div className="flex-1 bg-[var(--color-border)] rounded-full animate-pulse" />
              <div className="flex-1 bg-[var(--color-border)] rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex-1 space-y-2 md:space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1 md:py-1.5 px-2">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-[var(--color-border)] rounded-full animate-pulse shadow-sm" />
                  <div className="h-4 bg-[var(--color-border)] rounded w-20 animate-pulse" />
                </div>
                <div className="h-4 bg-[var(--color-border)] rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || spendingData.length === 0) {
    return (
      <Card width="full" className="flex flex-col h-full">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
        </div>
        
        <div className="flex-1 flex flex-col space-y-3 md:space-y-5">
          <div className="h-3 md:h-4 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-border)] rounded-full" />
          </div>
          <div className="flex-1 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-[var(--color-muted)] mb-2">
                {error ? 'Error loading data' : 'No spending data'}
              </div>
              <div className="text-xs text-[var(--color-muted)]">
                {error ? 'Please try again later' : 'Add transactions to see spending breakdown'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card width="full" className="flex flex-col h-full">
      <div className="mb-4 md:mb-6">
        <div className="text-sm text-[var(--color-muted)] mb-1">Spending Overview</div>
        <div className="text-xl md:text-2xl font-semibold text-[var(--color-fg)]">
          {formatCurrency(totalSpending)}
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-1">
          Past 30 days
        </div>
      </div>
      
      <div className="flex-1 flex flex-col space-y-3 md:space-y-5">
        {/* Segmented Bar */}
        <div className="h-3 md:h-4 rounded-full overflow-hidden">
          <div className="h-full flex gap-1">
            {spendingData.map((item, index) => {
              const percentage = totalSpending > 0 ? (item.total_spent / totalSpending) * 100 : 0;
              const isFirst = index === 0;
              const isLast = index === spendingData.length - 1;
              return (
                <div 
                  key={index}
                  className="transition-all duration-500 ease-out"
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: item.hex_color,
                    opacity: 0.9,
                    boxShadow: `0 0 8px ${item.hex_color}40, 0 0 4px ${item.hex_color}20`,
                    borderRadius: isFirst && isLast ? '9999px' : 
                                 isFirst ? '9999px 0 0 9999px' : 
                                 isLast ? '0 9999px 9999px 0' : '0'
                  }}
                />
              );
            })}
          </div>
        </div>
        
        {/* Category Rows */}
        <div className="flex-1 space-y-2 md:space-y-3">
          {spendingData.map((entry, index) => (
            <div key={index} className="flex items-center justify-between py-1 md:py-1.5 px-2 rounded-md hover:bg-[var(--color-muted)]/5 transition-colors">
              <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                <div 
                  className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 shadow-sm" 
                  style={{ backgroundColor: entry.hex_color }}
                />
                <span className="text-xs text-[var(--color-fg)] truncate">
                  {entry.label}
                </span>
              </div>
              <div className="text-xs md:text-sm font-semibold text-[var(--color-fg)] flex-shrink-0 ml-1 md:ml-2">
                {formatCurrency(entry.total_spent)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
