"use client";

import React, { useMemo } from 'react';
import { useAuthedQuery } from '../../lib/api/useAuthedQuery';
import { useUser } from '../providers/UserProvider';
import { FiTrendingUp } from 'react-icons/fi';
import { formatCurrency as formatCurrencyBase } from '../../lib/formatCurrency';

// Roll a recurring stream forward to its next occurrence on/after today.
// Mirrors the bills card: Plaid gives us a predicted_next_date, but it can
// fall in the past if a sync is stale, so we step it forward by frequency.
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

// Predicted paycheck size. Average is steadier than the last single deposit
// for variable pay, so we lead with it and fall back to last_amount.
const streamAmount = (stream) =>
  Math.abs(stream.average_amount || stream.last_amount || 0);

const FREQUENCY_LABEL = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  SEMI_MONTHLY: 'Twice a month',
  MONTHLY: 'Monthly',
  ANNUALLY: 'Yearly',
};
const cadenceLabel = (stream) => FREQUENCY_LABEL[stream.frequency] || 'Recurring';

const formatCurrency = (amount) => formatCurrencyBase(amount, true);

// "Today" / "Tomorrow" / "in 5 days", paired below with the absolute date.
const formatRelativeDay = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 14) return `in ${diff} days`;
  return `in ${Math.round(diff / 7)} weeks`;
};

const formatAbsoluteDay = (date) =>
  new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

const sourceLabel = (stream) =>
  stream.merchant_name || stream.description || 'Income';

function IncomeRow({ item }) {
  const { stream, nextDate } = item;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-xs text-[var(--color-fg)] truncate">
          {sourceLabel(stream)}
        </div>
        <div className="text-[11px] text-[var(--color-muted)]">
          {formatRelativeDay(nextDate)} · {cadenceLabel(stream)}
        </div>
      </div>
      <div className="text-xs font-medium tabular-nums text-[var(--color-success)] flex-shrink-0">
        {formatCurrency(streamAmount(stream))}
      </div>
    </div>
  );
}

export default function NextPaycheckCard({ className = '', mockData }) {
  const { user, isPro: liveIsPro, loading: authLoading } = useUser();
  const isPro = mockData ? true : liveIsPro;

  // Shares the exact query key + endpoint the bills card uses, so the two
  // sidebar cards hit the cache once and split the streams between them
  // (this card keeps inflows; the bills card keeps outflows).
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

  // Upcoming income, soonest first. The first is the headline paycheck.
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recurring
      // Genuine income only. Plaid tags internal account transfers
      // (you moving your own money) as TRANSFER_IN — those are not
      // paychecks and their averaged amounts are meaningless. Trusting
      // category_primary === 'INCOME' keeps wages/interest/dividends and
      // drops transfers, refunds, and other noise.
      .filter((s) => s.stream_type === 'inflow' && s.category_primary === 'INCOME')
      .map((stream) => ({ stream, nextDate: getNextOccurrence(stream) }))
      // Only forward-looking predictions. A stream we can't roll past
      // today (no predicted date + UNKNOWN frequency) is stale, not due
      // "Today" — drop it rather than show a misleading date.
      .filter((item) => item.nextDate && item.nextDate >= today)
      .sort((a, b) => a.nextDate - b.nextDate);
  }, [recurring]);

  const next = upcoming[0] || null;
  const rest = upcoming.slice(1);

  if (loading) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
            <div className="h-4 bg-[var(--color-border)] rounded w-14" />
          </div>
          <div className="h-7 bg-[var(--color-border)] rounded w-28 mb-1" />
          <div className="h-2.5 bg-[var(--color-border)] rounded w-36 mb-5" />
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2.5 bg-[var(--color-border)] rounded flex-1" />
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="card-header">Next paycheck</h3>
      </div>

      {!isPro ? (
        <div className="text-center py-6 text-xs text-[var(--color-muted)]">
          Upgrade to Pro to see income predictions
        </div>
      ) : next ? (
        <div>
          {/* Headline: the next predicted deposit — amount and when. */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-[var(--color-fg)]">
              {formatCurrency(streamAmount(next.stream))}
            </span>
            <span className="text-xs font-medium text-[var(--color-success)]">
              {formatRelativeDay(next.nextDate)}
            </span>
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-1">
            {sourceLabel(next.stream)} · {formatAbsoluteDay(next.nextDate)}
          </div>

          {rest.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mb-1">
                Also expected
              </div>
              <div className="flex flex-col">
                {rest.map((item, i) => (
                  <IncomeRow key={item.stream.id || i} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-2 flex items-start gap-2.5">
          <FiTrendingUp className="h-4 w-4 mt-0.5 text-[var(--color-muted)] flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-[var(--color-fg)]">
              No income detected yet
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-1">
              We&apos;ll predict your next paycheck once a few deposits land
              from the same source.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
