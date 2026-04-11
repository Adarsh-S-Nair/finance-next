"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { authFetch } from '../../lib/api/fetch';
import { useUser } from '../providers/UserProvider';
import { FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';
import Drawer from '../ui/Drawer';
import ViewAllLink from '../ui/ViewAllLink';
import { muteColor } from '../../lib/muteColor';

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

  if (loading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-40" />
            <div className="h-4 bg-[var(--color-border)] rounded w-14" />
          </div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-border)]" />
                <div className="flex-1">
                  <div className="h-2.5 bg-[var(--color-border)] rounded w-2/3 mb-1.5" />
                  <div className="h-2 bg-[var(--color-border)] rounded w-1/3" />
                </div>
                <div className="h-2.5 bg-[var(--color-border)] rounded w-12" />
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
        <h3 className="card-header">Upcoming</h3>
        <ViewAllLink onClick={() => setIsDrawerOpen(true)} />
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
                className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: showLogo
                      ? 'transparent'
                      : muteColor(stream.category_hex_color),
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
                      className="h-4 w-4 text-white"
                      fallback={FiTag}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 mr-3">
                  <div className="font-medium text-[var(--color-fg)] truncate text-xs">
                    {stream.merchant_name || stream.description || 'Recurring'}
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
                    {formatRelativeDate(nextDate)}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`font-medium text-xs tabular-nums ${isInflow ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
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
                    : muteColor(stream.category_hex_color),
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
