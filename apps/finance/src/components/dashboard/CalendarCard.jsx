"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { authFetch } from '../../lib/api/fetch';
import { useUser } from '../providers/UserProvider';
import { FiTag } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';
import { Drawer } from "@zervo/ui";
import { ViewAllLink } from "@zervo/ui";

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

function UpcomingRow({ stream, nextDate, disableLogos }) {
  const showLogo = !disableLogos && stream.icon_url && stream.merchant_name;
  const isInflow = stream.stream_type === 'inflow';
  const amount = stream.last_amount || 0;

  return (
    <div className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
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
            className="h-4 w-4 text-white"
            style={{ strokeWidth: 2.5 }}
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
}

export default function CalendarCard({ className = '', mockData }) {
  const { user, isPro: liveIsPro, loading: authLoading } = useUser();
  const isPro = mockData ? true : liveIsPro;
  const [recurring, setRecurring] = useState(mockData?.recurring || []);
  const [loading, setLoading] = useState(!mockData);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

  useEffect(() => {
    if (mockData) {
      setRecurring(mockData.recurring || []);
      setLoading(false);
      return;
    }
    if (authLoading) return;
    if (!user?.id) { setLoading(false); return; }
    const fetchRecurring = async () => {
      if (!liveIsPro) {
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
  }, [authLoading, user?.id, liveIsPro, mockData]);

  // Upcoming items: next 6 occurrences sorted by date. Split into bills
  // (outflows) and income (inflows) so the two don't visually collide — a
  // green "+$3,000" sitting beside a red bill confuses the hierarchy.
  // Bills are the primary concern; income gets a smaller secondary section.
  const { bills, income, allBillsSorted } = useMemo(() => {
    const all = recurring
      .map((stream) => ({ stream, nextDate: getNextOccurrence(stream) }))
      .filter((item) => item.nextDate)
      .sort((a, b) => a.nextDate - b.nextDate);

    const allBills = all.filter((u) => u.stream.stream_type !== "inflow");
    const billItems = allBills.slice(0, 5);
    const incomeItems = all.filter((u) => u.stream.stream_type === "inflow").slice(0, 2);
    return { bills: billItems, income: incomeItems, allBillsSorted: allBills };
  }, [recurring]);

  // 7-day strip: today + next 6 days. For each day, list of bills due.
  // Uses ALL bills (not just the top-5 in the list) so the strip is a
  // complete week-at-a-glance view of bill density.
  const weekStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const byKey = new Map();
    for (const { stream, nextDate } of allBillsSorted) {
      const d = new Date(nextDate);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff > 6) continue;
      const key = dayKey(d);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(stream);
    }

    const days = [];
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const streams = byKey.get(dayKey(d)) || [];
      days.push({
        date: d,
        isToday: i === 0,
        dayLabel: i === 0 ? "Today" : dayLabels[d.getDay()],
        dateNum: d.getDate(),
        streams,
      });
    }
    return days;
  }, [allBillsSorted]);

  const weekHasAnyBills = weekStrip.some((d) => d.streams.length > 0);

  const hasBills = bills.length > 0;
  const hasIncome = income.length > 0;
  const showSectionLabels = hasBills && hasIncome;

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

      {(hasBills || hasIncome) ? (
        <div className="flex flex-col">
          {/* Week-at-a-glance strip (bills only) */}
          {hasBills && (
            <div className="grid grid-cols-7 gap-0.5 mb-4">
              {weekStrip.map((day, i) => {
                const count = day.streams.length;
                const hasBillsOnDay = count > 0;
                const tooltip = hasBillsOnDay
                  ? day.streams
                      .map((s) => s.merchant_name || s.description || 'Recurring')
                      .join(', ')
                  : '';
                return (
                  <div
                    key={i}
                    title={tooltip}
                    className={`flex flex-col items-center py-1.5 rounded-md ${
                      day.isToday ? 'bg-[var(--color-surface-alt)]' : ''
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wide text-[var(--color-muted)] leading-none">
                      {day.dayLabel.slice(0, 3)}
                    </span>
                    <span
                      className={`text-[11px] font-medium tabular-nums mt-1 leading-none ${
                        day.isToday ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg)]'
                      }`}
                    >
                      {day.dateNum}
                    </span>
                    <div className="h-2 mt-1.5 flex items-center justify-center gap-0.5">
                      {hasBillsOnDay && (
                        <>
                          {count === 1 && (
                            <span className="w-1 h-1 rounded-full bg-[var(--color-fg)]" />
                          )}
                          {count === 2 && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-[var(--color-fg)]" />
                              <span className="w-1 h-1 rounded-full bg-[var(--color-fg)]" />
                            </>
                          )}
                          {count >= 3 && (
                            <span className="text-[8px] font-semibold text-[var(--color-fg)] leading-none tabular-nums">
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {!weekHasAnyBills && (
                <div className="col-span-7 -mt-1 text-center text-[10px] text-[var(--color-muted)]">
                  No bills due this week
                </div>
              )}
            </div>
          )}

          {hasBills && (
            <>
              {showSectionLabels && (
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] px-2 mb-1">
                  Bills
                </div>
              )}
              <div className="flex flex-col -mx-2">
                {bills.map(({ stream, nextDate }, idx) => (
                  <UpcomingRow
                    key={stream.id || `bill-${idx}`}
                    stream={stream}
                    nextDate={nextDate}
                    disableLogos={DISABLE_LOGOS}
                  />
                ))}
              </div>
            </>
          )}

          {hasIncome && (
            <>
              {showSectionLabels && (
                <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] px-2 mt-3 mb-1">
                  Expected income
                </div>
              )}
              <div className="flex flex-col -mx-2">
                {income.map(({ stream, nextDate }, idx) => (
                  <UpcomingRow
                    key={stream.id || `income-${idx}`}
                    stream={stream}
                    nextDate={nextDate}
                    disableLogos={DISABLE_LOGOS}
                  />
                ))}
              </div>
            </>
          )}
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
