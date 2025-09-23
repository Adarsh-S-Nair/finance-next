"use client";

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
        setSpendingData(result.categories || []);
        
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

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.hex_color }}
            />
            <span className="text-sm font-medium text-[var(--color-text)]">
              {data.label}
            </span>
          </div>
          <div className="text-sm text-[var(--color-muted)]">
            {formatCurrency(data.total_spent)} ({data.percentage.toFixed(1)}%)
          </div>
        </div>
      );
    }
    return null;
  };


  if (loading) {
    return (
      <Card width="1/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
        </div>
        
        <div className="h-40 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-[var(--color-muted)]">
              Loading...
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error || spendingData.length === 0) {
    return (
      <Card width="1/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
        </div>
        
        <div className="h-40 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-[var(--color-muted)] mb-2">
              {error ? 'Error loading data' : 'No spending data'}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {error ? 'Please try again later' : 'Add transactions to see spending breakdown'}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card width="1/3">
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
      </div>
      
      <div className="h-40 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={spendingData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={0.5}
              dataKey="total_spent"
              isAnimationActive={false}
            >
              {spendingData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.hex_color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
