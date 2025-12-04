"use client";

import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';
import { FiRefreshCw, FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';

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
  // Parse YYYY-MM-DD as local time to avoid timezone shifts (e.g. UTC midnight -> previous day EST)
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

export default function RecurringTransactionsCard() {
  const { user } = useUser();
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  // Calculate total monthly recurring cost
  const totalMonthly = recurring.reduce((acc, item) => {
    let monthlyAmount = item.amount;
    if (item.frequency === 'weekly') monthlyAmount = item.amount * 4.33;
    if (item.frequency === 'bi-weekly') monthlyAmount = item.amount * 2.16;
    if (item.frequency === 'yearly') monthlyAmount = item.amount / 12;
    return acc + monthlyAmount;
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
        <div className="mb-4 flex items-center gap-2">
          <div className="text-sm font-medium text-[var(--color-muted)]">Recurring Bills</div>
        </div>
        <div className="text-center py-8 text-[var(--color-muted)] text-sm font-light">
          No recurring bills detected yet.
        </div>
      </Card>
    );
  }

  return (
    <Card width="full" variant="glass" className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-sm font-medium text-[var(--color-muted)] mb-1">Monthly Bills</div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-[var(--color-fg)]">
              {formatCurrency(totalMonthly)}
            </span>
            <span className="text-xs text-[var(--color-muted)]">/mo</span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 min-h-0 overflow-hidden">
        <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">Upcoming</div>
        <div className="space-y-1">
          {recurring.slice(0, 3).map((item) => (
            <RecurringTransactionItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {recurring.length > 3 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]/50">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-full text-center text-xs text-[var(--color-accent)] hover:text-[var(--color-fg)] transition-colors font-medium"
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
            <RecurringTransactionItem key={item.id} item={item} />
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={async () => {
              if (window.confirm('This will delete all existing recurring transactions and re-scan your history. Are you sure?')) {
                try {
                  setLoading(true);
                  const res = await fetch('/api/debug/detect-recurring', {
                    method: 'POST',
                    body: JSON.stringify({ userId: user.id, clearBeforeRun: true })
                  });
                  const json = await res.json();
                  if (json.success) {
                    // Refresh list
                    const response = await fetch(`/api/recurring/get?userId=${user.id}`);
                    const result = await response.json();
                    setRecurring(result.recurring || []);
                    alert('Detection complete!');
                  } else {
                    alert('Error: ' + json.error);
                  }
                } catch (e) {
                  console.error(e);
                  alert('Failed to run detection');
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="w-full py-3 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FiRefreshCw className="w-3 h-3" />
            Re-detect Recurring Transactions
          </button>
        </div>
      </Drawer>
    </Card>
  );
}

function RecurringTransactionItem({ item }) {
  return (
    <div
      className="flex items-center justify-between py-2 px-2 rounded-sm hover:bg-[var(--color-muted)]/5 transition-colors gap-2"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Logo or Fallback */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 border border-[var(--color-border)]/50"
          style={{
            backgroundColor: item.icon_url
              ? 'var(--color-muted)/10'
              : (item.category?.group?.hex_color || 'var(--color-accent)')
          }}
        >
          {item.icon_url ? (
            <img
              src={item.icon_url}
              alt={item.merchant_name}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}

          {/* Fallback: Category Icon or Initial */}
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ display: item.icon_url ? 'none' : 'flex' }}
          >
            {item.category?.group?.icon_name ? (
              <DynamicIcon
                iconLib={item.category.group.icon_lib}
                iconName={item.category.group.icon_name}
                className="h-4 w-4 text-white"
                fallback={FiTag}
              />
            ) : (
              <span className="text-[var(--color-muted)] text-xs font-medium">
                {item.merchant_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--color-fg)] truncate">
            {item.merchant_name}
          </div>
          <div className="text-xs text-[var(--color-muted)] capitalize">
            {item.category?.label || item.frequency}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm font-medium text-[var(--color-fg)]">
          {formatCurrency(item.amount)}
        </div>
        <div className="text-xs text-[var(--color-muted)]">
          {formatDate(item.next_date)}
        </div>
      </div>
    </div >
  );
}
