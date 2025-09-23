"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '../UserProvider';
import Card from '../ui/Card';
import DonutChart from '../ui/DonutChart';

export default function SpendingOverviewCard() {
  const { user } = useUser();
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch spending data by category
  useEffect(() => {
    const fetchSpendingByCategory = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/transactions/spending-by-category?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch spending by category data');
        }
        
        const result = await response.json();
        console.log('Spending by category API Response:', result);
        setCategoryData(result.categories || []);
        
      } catch (err) {
        console.error('Error fetching spending by category data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSpendingByCategory();
  }, [user?.id]);

  if (loading) {
    return (
      <Card width="1/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
        </div>
        
        <div className="h-40 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-[var(--color-muted)] mb-2">
              Loading...
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              Fetching spending data
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card width="1/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Spending Overview</div>
        </div>
        
        <div className="h-40 w-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-[var(--color-muted)] mb-2">
              Error
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              Failed to load spending data
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
      
      <div className="w-full">
        <DonutChart 
          data={categoryData}
          width={200}
          height={200}
          innerRadius={50}
          outerRadius={80}
        />
      </div>
    </Card>
  );
}
