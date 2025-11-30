"use client";

import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';
import { FiCalendar, FiRefreshCw } from 'react-icons/fi';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return 'Overdue';
  if (diffDays <= 7) return `In ${diffDays} days`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export default function RecurringTransactionsCard() {
  const { user } = useUser();
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecurring = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/recurring/get?userId=${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        setRecurring(result.recurring || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecurring();
  }, [user?.id]);

  if (loading) {
    return (
      <Card width="full" className="animate-pulse" variant="glass">
        <div className="mb-4 flex justify-between items-center">
          <div className="h-4 bg-[var(--color-border)] rounded w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-2">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 bg-[var(--color-border)] rounded-full" />
                <div className="h-4 bg-[var(--color-border)] rounded w-24" />
              </div>
              <div className="h-4 bg-[var(--color-border)] rounded w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!recurring || recurring.length === 0) {
    // Don't show anything if no recurring transactions found? 
    // Or show a placeholder. Let's show a placeholder for now.
    return (
      <Card width="full" variant="glass">
        <div className="mb-4 flex items-center gap-2">
          <FiRefreshCw className="text-[var(--color-accent)]" />
          <div className="text-sm text-[var(--color-muted)] font-light uppercase tracking-wider">Recurring</div>
        </div>
        <div className="text-center py-8 text-[var(--color-muted)] text-sm font-light">
          No recurring bills detected yet.
        </div>
      </Card>
    );
  }

  return (
    <Card width="full" variant="glass">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FiRefreshCw className="text-[var(--color-accent)]" />
          <div className="text-sm text-[var(--color-muted)] font-light uppercase tracking-wider">Recurring Bills</div>
        </div>
        <div className="text-xs text-[var(--color-muted)] font-light">
          Next 30 Days
        </div>
      </div>

      <div className="space-y-1">
        {recurring.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-2 px-2 rounded-sm hover:bg-[var(--color-muted)]/5 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Icon Placeholder - could be merchant logo if we had it */}
              <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-muted)] text-xs border border-[var(--color-border)]">
                {item.merchant_name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                  {item.merchant_name}
                </div>
                <div className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                  <FiCalendar className="w-3 h-3" />
                  {formatDate(item.next_date)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-medium text-[var(--color-fg)]">
                {formatCurrency(item.amount)}
              </div>
              <div className="text-xs text-[var(--color-muted)] capitalize">
                {item.frequency}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
