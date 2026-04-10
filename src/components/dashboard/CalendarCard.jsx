"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { authFetch } from '../../lib/api/fetch';
import { useUser } from '../providers/UserProvider';
import { FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';
import Drawer from '../ui/Drawer';
import ViewAllLink from '../ui/ViewAllLink';

// Get next occurrence on/after today for a recurring stream
const getNextOccurrence = (stream) => {
  const baseDate = stream.predicted_next_date || stream.last_date;
  if (!baseDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = baseDate.split('-').map(Number);
  let date = new Date(y, m - 1, d);

  if (date >= today) return date;
  if (!stream.frequency) return date;

  let iterations = 0;
  while (date < today && iterations < 500) {
    switch (stream.frequency) {
      case 'WEEKLY':
        date.setDate(date.getDate() + 7);
        break;
      case 'BIWEEKLY':
      case 'SEMI_MONTHLY':
        date.setDate(date.getDate() + 14);
        break;
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'ANNUALLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return date;
    }
    iterations++;
  }
  return date;
};

// Count all occurrences of a stream within the current month (for summary)
const getMonthOccurrenceCount = (stream, year, month) => {
  const baseDate = stream.last_date || stream.predicted_next_date;
  if (!baseDate || !stream.frequency) return 0;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const [y, m, d] = baseDate.split('-').map(Number);
  let current = new Date(y, m - 1, d);

  if (current > monthEnd) return 0;

  let count = 0;
  let iterations = 0;
  while (current <= monthEnd && iterations < 500) {
    if (current >= monthStart) count++;
    switch (stream.frequency) {
      case 'WEEKLY':
        current.setDate(current.getDate() + 7);
        break;
      case 'BIWEEKLY':
      case 'SEMI_MONTHLY':
        current.setDate(current.getDate() + 14);
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'ANNUALLY':
        current.setFullYear(current.getFullYear() + 1);
        break;
      default:
        return count;
    }
    iterations++;
  }
  return count;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatRelativeDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`;
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function CalendarCard({ className = '' }) {
  const { user, isPro, loading: authLoading } = useUser();
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) { setLoading(false); return; }
    const fetchRecurring = async () => {
      if (!isPro) {
        setRecurring([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await authFetch(`/api/recurring/get`);
        if (!response.ok) throw new Error('Failed to fetch');
        const result = await response.json();
        setRecurring(result.recurring || []);
      } catch (err) {
        console.error('Error fetching recurring:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecurring();
  }, [authLoading, user?.id, isPro]);

  // Upcoming items: next 6 occurrences sorted by date
  const upcoming = useMemo(() => {
    return recurring
      .map((stream) => ({ stream, nextDate: getNextOccurrence(stream) }))
      .filter((item) => item.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate)
      .slice(0, 6);
  }, [recurring]);

  // Current month summary (outflows only) — paid vs remaining
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = new Date(year, month, now.getDate());
    today.setHours(0, 0, 0, 0);

    let paidAmount = 0;
    let remainingAmount = 0;
    let paidCount = 0;
    let remainingCount = 0;

    recurring.forEach((stream) => {
      if (stream.stream_type !== 'outflow') return;
      const occurrenceCount = getMonthOccurrenceCount(stream, year, month);
      if (occurrenceCount === 0) return;

      // Determine if next occurrence is still ahead or already passed
      const next = getNextOccurrence(stream);
      const nextInThisMonth = next && next.getFullYear() === year && next.getMonth() === month;
      const amount = Math.abs(stream.last_amount || 0);

      if (nextInThisMonth) {
        remainingAmount += amount;
        remainingCount += 1;
        // Any occurrences before "next" are already paid
        if (occurrenceCount > 1) {
          paidAmount += amount * (occurrenceCount - 1);
          paidCount += occurrenceCount - 1;
        }
      } else {
        // All this month's occurrences are in the past
        paidAmount += amount * occurrenceCount;
        paidCount += occurrenceCount;
      }
    });

    const totalAmount = paidAmount + remainingAmount;
    const totalCount = paidCount + remainingCount;
    const paidPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return { paidAmount, remainingAmount, totalAmount, paidCount, remainingCount, totalCount, paidPercentage };
  }, [recurring]);

  if (loading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-40" />
            <div className="h-4 bg-[var(--color-border)] rounded w-14" />
          </div>
          <div className="mb-4">
            <div className="h-7 bg-[var(--color-border)] rounded w-32 mb-2" />
            <div className="h-1.5 bg-[var(--color-border)] rounded w-full mb-2" />
            <div className="h-3 bg-[var(--color-border)] rounded w-full" />
          </div>
          <div className="space-y-3 mt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-border)]" />
                <div className="flex-1">
                  <div className="h-3 bg-[var(--color-border)] rounded w-2/3 mb-1.5" />
                  <div className="h-2.5 bg-[var(--color-border)] rounded w-1/3" />
                </div>
                <div className="h-3 bg-[var(--color-border)] rounded w-14" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Title Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="card-header">Recurring Transactions</h3>
        <ViewAllLink onClick={() => setIsDrawerOpen(true)} />
      </div>

      {/* Bills Summary Header */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-2xl font-semibold text-[var(--color-fg)] tracking-tight">
              {formatCurrency(monthlySummary.remainingAmount)}
            </span>
            <span className="text-xs text-[var(--color-muted)] ml-1">remaining this month</span>
          </div>
          <div className="text-xs text-[var(--color-muted)] font-medium">
            {monthlySummary.totalCount} bill{monthlySummary.totalCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-[var(--color-accent)]"
            style={{ width: `${monthlySummary.paidPercentage}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>{formatCurrency(monthlySummary.paidAmount)} paid</span>
          <span>out of {formatCurrency(monthlySummary.totalAmount)}</span>
        </div>
      </div>

      {/* Up Next Section */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Up Next
        </div>
      </div>

      {upcoming.length > 0 ? (
        <div className="flex flex-col -mx-2">
          {upcoming.map(({ stream, nextDate }, idx) => {
            const showLogo = !DISABLE_LOGOS && stream.icon_url && stream.merchant_name;
            const isInflow = stream.stream_type === 'inflow';
            const amount = stream.last_amount || 0;

            return (
              <div
                key={stream.id || idx}
                className="flex items-center gap-4 py-2 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: showLogo
                      ? 'transparent'
                      : (stream.category_hex_color || 'var(--color-accent)'),
                  }}
                >
                  {showLogo ? (
                    <img
                      src={stream.icon_url}
                      alt={stream.merchant_name || ''}
                      className="w-full h-full object-cover rounded-full"
                      loading="lazy"
                    />
                  ) : (
                    <DynamicIcon
                      iconLib={stream.category_icon_lib}
                      iconName={stream.category_icon_name}
                      className="h-5 w-5 text-white"
                      fallback={FiTag}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 mr-4">
                  <div className="font-medium text-[var(--color-fg)] truncate text-sm">
                    {stream.merchant_name || stream.description || 'Recurring'}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
                    {formatRelativeDate(nextDate)}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`font-medium text-sm tabular-nums ${isInflow ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
                    {isInflow ? '+' : ''}{formatCurrency(amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-[var(--color-muted)]">
          {isPro ? 'No upcoming recurring transactions' : 'Upgrade to Pro to see recurring transactions'}
        </div>
      )}

      {/* View All Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Recurring Transactions"
        width="md"
      >
        <div className="space-y-1">
          {recurring.sort((a, b) => {
            const dateA = a.predicted_next_date || a.last_date;
            const dateB = b.predicted_next_date || b.last_date;
            return new Date(dateA) - new Date(dateB);
          }).map((stream, idx) => (
            <div key={stream.id || idx} className="flex items-center gap-3 p-3 hover:bg-[var(--color-surface-alt)] rounded-xl transition-colors">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{
                  backgroundColor: (!DISABLE_LOGOS && stream.icon_url && stream.merchant_name)
                    ? 'transparent'
                    : (stream.category_hex_color || 'var(--color-accent)'),
                }}
              >
                {(!DISABLE_LOGOS && stream.icon_url && stream.merchant_name) ? (
                  <img src={stream.icon_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <DynamicIcon
                    iconLib={stream.category_icon_lib}
                    iconName={stream.category_icon_name}
                    className="w-5 h-5 text-white"
                    fallback={FiTag}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                  {stream.merchant_name || stream.description}
                </div>
                <div className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                  <span className="capitalize">{stream.frequency?.toLowerCase() || 'Recurring'}</span>
                  <span>•</span>
                  <span>{stream.predicted_next_date ? new Date(stream.predicted_next_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</span>
                </div>
              </div>

              <div className={`text-sm font-semibold tabular-nums ${stream.stream_type === 'inflow' ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
                {stream.stream_type === 'inflow' ? '+' : ''}{formatCurrency(stream.last_amount)}
              </div>
            </div>
          ))}

          {recurring.length === 0 && (
            <div className="text-center py-10 text-[var(--color-muted)]">
              {isPro ? 'No recurring transactions found' : (
                <span className="text-xs text-[var(--color-muted)]">
                  Upgrade to Pro to see recurring transactions
                </span>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
