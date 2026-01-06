"use client";

import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';
import { FiRefreshCw, FiTag, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import Drawer from '../ui/Drawer';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
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

function formatFrequency(frequency) {
  const map = {
    'WEEKLY': 'Weekly',
    'BIWEEKLY': 'Bi-weekly',
    'SEMI_MONTHLY': 'Twice monthly',
    'MONTHLY': 'Monthly',
    'ANNUALLY': 'Yearly',
    'UNKNOWN': 'Variable',
  };
  return map[frequency] || frequency;
}

function getMonthlyAmount(amount, frequency) {
  switch (frequency) {
    case 'WEEKLY': return amount * 4.33;
    case 'BIWEEKLY': return amount * 2.16;
    case 'SEMI_MONTHLY': return amount * 2;
    case 'MONTHLY': return amount;
    case 'ANNUALLY': return amount / 12;
    default: return amount;
  }
}

export default function RecurringTransactionsCard() {
  const { user } = useUser();
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchRecurring = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      // Fetch only outflow (expenses/bills) by default
      const response = await fetch(`/api/recurring/get?userId=${user.id}&streamType=outflow`);
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

  useEffect(() => {
    fetchRecurring();
  }, [user?.id]);

  const handleSync = async () => {
    if (!user?.id || syncing) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/plaid/recurring/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh the list after sync
        await fetchRecurring();
      } else {
        console.error('Sync failed:', result.error);
      }
    } catch (err) {
      console.error('Error syncing:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Calculate total monthly recurring cost
  const totalMonthly = recurring.reduce((acc, item) => {
    return acc + getMonthlyAmount(item.last_amount, item.frequency);
  }, 0);

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
    return (
      <Card width="full" variant="glass">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-[var(--color-muted)]">Recurring Bills</div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex items-center gap-1"
          >
            <FiRefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
        <div className="text-center py-8 text-[var(--color-muted)] text-sm font-light">
          No recurring bills detected yet.
          <br />
          <span className="text-xs">Click sync to fetch from your accounts.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card width="full" variant="glass" className="flex flex-col h-full">
      {/* Header with Total */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-[var(--color-muted)]">Upcoming Bills</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-[var(--color-fg)]">
              {formatCurrency(totalMonthly)}
            </span>
            <span className="text-xs text-[var(--color-muted)]">/mo</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            title="Sync recurring transactions"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Minimal List */}
      <div className="flex-1 space-y-1 min-h-0 overflow-hidden">
        {recurring.slice(0, 4).map((item) => (
          <RecurringStreamItem key={item.id} item={item} />
        ))}
      </div>

      {recurring.length > 4 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]/50">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors font-medium"
          >
            View all {recurring.length} bills
          </button>
        </div>
      )}

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Recurring Bills"
        description={`Total monthly cost: ${formatCurrency(totalMonthly)}`}
        size="md"
      >
        <div className="space-y-1 mt-4">
          {recurring.map((item) => (
            <RecurringStreamItem key={item.id} item={item} showDetails />
          ))}
        </div>
      </Drawer>
    </Card>
  );
}

function RecurringStreamItem({ item, showDetails = false }) {
  const displayName = item.merchant_name || item.description;
  const displayDate = item.predicted_next_date || item.last_date;

  return (
    <div
      className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors gap-3 group cursor-pointer -mx-2"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Icon placeholder - first letter of merchant */}
        <div className="w-8 h-8 flex items-center justify-center text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors rounded-full bg-[var(--color-surface)]">
          <span className="text-sm font-medium">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--color-fg)] truncate">
            {displayName}
          </div>
          <div className="text-xs text-[var(--color-muted)] flex items-center gap-2">
            <span>{formatDate(displayDate)}</span>
            {showDetails && (
              <>
                <span>•</span>
                <span>{formatFrequency(item.frequency)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
          {formatCurrency(item.last_amount)}
        </div>
        {showDetails && item.average_amount !== item.last_amount && (
          <div className="text-xs text-[var(--color-muted)]">
            avg {formatCurrency(item.average_amount)}
          </div>
        )}
      </div>
    </div>
  );
}
