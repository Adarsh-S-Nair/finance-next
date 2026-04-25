"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useAuthedQuery } from '../../lib/api/useAuthedQuery';
import { useUser } from '../providers/UserProvider';
import { FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';
import { Drawer } from "@zervo/ui";
import { ViewAllLink } from "@zervo/ui";
import { formatCurrency as formatCurrencyBase } from '../../lib/formatCurrency';

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

const formatCurrency = (amount) => formatCurrencyBase(amount, true);
const formatCurrencyWhole = (amount) => formatCurrencyBase(amount, false);

const formatDayLabel = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

function BillRow({ stream, disableLogos }) {
  const showLogo = !disableLogos && stream.icon_url && stream.merchant_name;
  const amount = Math.abs(stream.last_amount || 0);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
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
            className="h-3.5 w-3.5 text-white"
            style={{ strokeWidth: 2.5 }}
            fallback={FiTag}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-xs text-[var(--color-fg)] truncate">
          {stream.merchant_name || stream.description || 'Recurring'}
        </div>
      </div>
      <div className="text-xs font-medium tabular-nums text-[var(--color-fg)] flex-shrink-0">
        {formatCurrency(amount)}
      </div>
    </div>
  );
}

export default function CalendarCard({ className = '', mockData }) {
  const { user, isPro: liveIsPro, loading: authLoading } = useUser();
  const isPro = mockData ? true : liveIsPro;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

  // Cached across navigations via react-query. Recurring streams only
  // change when Plaid refreshes them, so a 30s stale window is fine
  // and means re-visiting the dashboard shows the upcoming-bills list
  // instantly instead of flashing a loader.
  const queryEnabled = !mockData && !authLoading && !!user?.id && liveIsPro;
  const { data, isLoading } = useAuthedQuery(
    ['dashboard-recurring', user?.id],
    queryEnabled ? '/api/recurring/get' : null,
  );
  const recurring = useMemo(
    () => mockData?.recurring ?? data?.recurring ?? [],
    [mockData?.recurring, data?.recurring],
  );
  const loading = mockData ? false : queryEnabled ? isLoading : false;

  // Group upcoming bills (outflows only) by day for the next 7 days.
  // weekTotal drives the headline; nextBeyond is the fallback when the week is empty.
  const { dayGroups, weekTotal, nextBeyond } = useMemo(() => {
    const bills = recurring
      .filter((s) => s.stream_type !== 'inflow')
      .map((stream) => ({ stream, nextDate: getNextOccurrence(stream) }))
      .filter((item) => item.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const within = bills.filter(({ nextDate }) => nextDate >= today && nextDate < weekEnd);
    const beyond = bills.filter(({ nextDate }) => nextDate >= weekEnd);

    const total = within.reduce(
      (acc, { stream }) => acc + Math.abs(stream.last_amount || 0),
      0,
    );

    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const map = new Map();
    for (const item of within) {
      const d = new Date(item.nextDate);
      d.setHours(0, 0, 0, 0);
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, { date: d, items: [] });
      map.get(k).items.push(item);
    }
    const groups = Array.from(map.values()).sort((a, b) => a.date - b.date);

    return {
      dayGroups: groups,
      weekTotal: total,
      nextBeyond: beyond[0] || null,
    };
  }, [recurring]);

  const hasBillsThisWeek = dayGroups.length > 0;

  if (loading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-40" />
            <div className="h-4 bg-[var(--color-border)] rounded w-14" />
          </div>
          <div className="h-7 bg-[var(--color-border)] rounded w-24 mb-1" />
          <div className="h-2.5 bg-[var(--color-border)] rounded w-32 mb-5" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="h-2 bg-[var(--color-border)] rounded w-16 mb-2" />
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-border)]" />
                  <div className="h-2.5 bg-[var(--color-border)] rounded flex-1" />
                  <div className="h-2.5 bg-[var(--color-border)] rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="card-header">Upcoming bills</h3>
        <ViewAllLink onClick={() => setIsDrawerOpen(true)} />
      </div>

      {!isPro ? (
        <div className="text-center py-6 text-xs text-[var(--color-muted)]">
          Upgrade to Pro to see recurring transactions
        </div>
      ) : hasBillsThisWeek ? (
        <div>
          <div className="mb-4">
            <div className="text-2xl font-semibold text-[var(--color-fg)] tabular-nums leading-none">
              {formatCurrencyWhole(weekTotal)}
            </div>
            <div className="text-[11px] text-[var(--color-muted)] mt-1.5">
              Due in the next 7 days
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {dayGroups.map((group, i) => (
              <div key={i}>
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mb-0.5">
                  {formatDayLabel(group.date)}
                </div>
                <div className="flex flex-col">
                  {group.items.map(({ stream }, j) => (
                    <BillRow
                      key={stream.id || `${i}-${j}`}
                      stream={stream}
                      disableLogos={DISABLE_LOGOS}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-2">
          <div className="text-sm font-medium text-[var(--color-fg)]">
            No bills due this week
          </div>
          {nextBeyond && (
            <div className="text-xs text-[var(--color-muted)] mt-1.5">
              Next:{' '}
              <span className="text-[var(--color-fg)]">
                {nextBeyond.stream.merchant_name || nextBeyond.stream.description || 'Recurring'}
              </span>{' '}
              on{' '}
              {nextBeyond.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {formatCurrency(Math.abs(nextBeyond.stream.last_amount || 0))}
            </div>
          )}
        </div>
      )}

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Recurring transactions"
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
                    style={{ strokeWidth: 2.5 }}
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
