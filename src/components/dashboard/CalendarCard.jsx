"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';
import { FiChevronLeft, FiChevronRight, FiTag, FiX } from 'react-icons/fi';
import DynamicIcon from '../DynamicIcon';
import Drawer from '../ui/Drawer';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// Helper to calculate next due date if the current one is in the past
const getNextDueDate = (dateStr, frequency) => {
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);

  // If date is in future or today, return it
  if (date >= today) return dateStr;

  // If date is in past, calculate next occurrence based on frequency
  if (!frequency) return dateStr;

  const nextDate = new Date(date);
  while (nextDate < today) {
    switch (frequency) {
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
      case 'SEMI_MONTHLY':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'ANNUALLY':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        return dateStr;
    }
  }

  return nextDate.toISOString().split('T')[0];
};


// Generate ALL occurrences of a recurring stream for a given month (past and future)
const getOccurrencesForMonth = (stream, year, month) => {
  const occurrences = [];
  const baseDate = stream.last_date || stream.predicted_next_date;
  if (!baseDate || !stream.frequency) return occurrences;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  // Start from the original recurring date
  let currentDate = new Date(baseDate);

  // If the base date is after our target month, we can't have occurrences
  // (unless it's a past-dated stream that hasn't happened yet)
  if (currentDate > monthEnd) return occurrences;

  // Fast forward or rewind to find the first occurrence in or before the target month
  // First, if we're way before the month, fast forward
  let iterations = 0;
  const maxIterations = 500; // Safety limit for very old streams

  while (currentDate < monthStart && iterations < maxIterations) {
    const nextDate = new Date(currentDate);
    switch (stream.frequency) {
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
      case 'SEMI_MONTHLY':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'ANNUALLY':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        return occurrences;
    }

    // If next occurrence would be past the month, stop at current
    if (nextDate > monthEnd) break;

    currentDate = nextDate;
    iterations++;
  }

  // Now collect all occurrences within this month
  iterations = 0;
  const monthIterationLimit = 10;

  while (currentDate <= monthEnd && iterations < monthIterationLimit) {
    if (currentDate >= monthStart && currentDate <= monthEnd) {
      occurrences.push(currentDate.toISOString().split('T')[0]);
    }

    // Move to next occurrence
    switch (stream.frequency) {
      case 'WEEKLY':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
      case 'SEMI_MONTHLY':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'MONTHLY':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'ANNUALLY':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        iterations = monthIterationLimit;
    }
    iterations++;
  }

  return occurrences;
};

export default function CalendarCard({ className = '' }) {
  const { user } = useUser();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

  // Format currency helper
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date for tooltip
  const formatDateForTooltip = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Fetch recurring streams
  useEffect(() => {
    const fetchRecurring = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        // Fetch all recurring streams (both inflow and outflow) by removing streamType filter
        const response = await fetch(`/api/recurring/get?userId=${user.id}`);
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
  }, [user?.id]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];

    // Previous month's trailing days
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isPrevMonth: true,
        date: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(daysInPrevMonth - i).padStart(2, '0')}`
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        isPrevMonth: false,
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }

    // Next month's leading days to complete the grid (6 rows * 7 days = 42)
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const remainingDays = 42 - days.length;

    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        day,
        isCurrentMonth: false,
        isPrevMonth: false,
        date: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }

    return days;
  }, [currentMonth, currentYear]);

  // Map dates to their recurring streams for displayed months
  const dateToStreams = useMemo(() => {
    const map = {};

    // Check current month, prev month, and next month for occurrences
    const monthsToCheck = [
      { year: currentYear, month: currentMonth },
      { year: currentMonth === 0 ? currentYear - 1 : currentYear, month: currentMonth === 0 ? 11 : currentMonth - 1 },
      { year: currentMonth === 11 ? currentYear + 1 : currentYear, month: currentMonth === 11 ? 0 : currentMonth + 1 }
    ];

    recurring.forEach(stream => {
      monthsToCheck.forEach(({ year, month }) => {
        const occurrences = getOccurrencesForMonth(stream, year, month);
        occurrences.forEach(date => {
          if (!map[date]) map[date] = [];
          map[date].push(stream);
        });
      });
    });

    return map;
  }, [recurring, currentMonth, currentYear]);

  const todayString = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  // Calculate monthly summary stats - paid vs remaining
  const monthlySummary = useMemo(() => {
    let paidAmount = 0;
    let remainingAmount = 0;
    let paidCount = 0;
    let remainingCount = 0;
    const seenStreams = new Map(); // Track stream id -> { amount, isPast }

    // Count unique streams and their amounts for current month
    Object.entries(dateToStreams).forEach(([date, streams]) => {
      // Check if date is in current displayed month
      const [year, month] = date.split('-').map(Number);
      if (year === currentYear && month === currentMonth + 1) {
        const isPastDate = date < todayString;

        streams.forEach(stream => {
          // Only count outflows (bills) for the summary/progress bar
          if (stream.stream_type === 'outflow' && !seenStreams.has(stream.id)) {
            seenStreams.set(stream.id, {
              amount: stream.last_amount || 0,
              isPast: isPastDate
            });
          }
        });
      }
    });

    // Sum up paid and remaining
    seenStreams.forEach(({ amount, isPast }) => {
      if (isPast) {
        paidAmount += amount;
        paidCount++;
      } else {
        remainingAmount += amount;
        remainingCount++;
      }
    });

    const totalAmount = paidAmount + remainingAmount;
    const totalCount = paidCount + remainingCount;
    const paidPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return { paidAmount, remainingAmount, totalAmount, paidCount, remainingCount, totalCount, paidPercentage };
  }, [dateToStreams, currentMonth, currentYear, todayString]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Render the event indicator - positioned bottom-right, slightly overlapping date
  const renderEventIndicator = (streams, isPast = false) => {
    if (!streams || streams.length === 0) return null;

    const maxVisible = 2;
    const visibleStreams = streams.slice(0, maxVisible);
    const overflow = streams.length - maxVisible;

    return (
      <div
        className={`absolute -bottom-0.5 -right-0.5 flex items-center ${isPast ? 'opacity-60 saturate-50' : ''}`}
      >
        <div className="flex -space-x-1.5">
          {visibleStreams.map((stream, idx) => (
            <div
              key={stream.id || idx}
              className="w-4 h-4 rounded-full border-[1.5px] border-[var(--color-surface)] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm"
              style={{
                backgroundColor: (!DISABLE_LOGOS && stream.icon_url && stream.merchant_name)
                  ? 'transparent'
                  : (stream.category_hex_color || 'var(--color-accent)'),
                zIndex: 10 + (maxVisible - idx),
              }}
            >
              {(!DISABLE_LOGOS && stream.icon_url && stream.merchant_name) ? (
                <img
                  src={stream.icon_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <DynamicIcon
                  iconLib={stream.category_icon_lib}
                  iconName={stream.category_icon_name}
                  className="w-2.5 h-2.5 text-white"
                  fallback={FiTag}
                />
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div
              className="w-4 h-4 rounded-full border-[1.5px] border-[var(--color-surface)] flex items-center justify-center bg-[var(--color-muted)] shadow-sm"
              style={{ zIndex: 10 }}
            >
              <span className="text-[8px] font-bold text-white">+{overflow}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card width="full" variant="glass" className={`flex flex-col ${className}`} allowOverflow>

      {/* Title Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-muted)]">Recurring Transactions</h3>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          View all
        </button>
      </div>

      {/* Bills Summary Header */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-2xl font-semibold text-[var(--color-fg)] tracking-tight">
              {formatCurrency(monthlySummary.remainingAmount)}
            </span>
            <span className="text-xs text-[var(--color-muted)] ml-1">remaining</span>
          </div>
          <div className="text-xs text-[var(--color-muted)] font-medium">
            {monthlySummary.totalCount} bill{monthlySummary.totalCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden mb-2">
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

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPrevMonth}
          className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label="Previous month"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-sm font-medium text-[var(--color-fg)]">
          {MONTHS[currentMonth]} {currentYear}
        </div>

        <button
          onClick={goToNextMonth}
          className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label="Next month"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayData, index) => {
          const isToday = dayData.date === todayString;
          const streams = dateToStreams[dayData.date] || [];
          const hasEvents = streams.length > 0;
          const isHovered = hoveredDate === dayData.date;
          const isPastDate = dayData.date < todayString;

          return (
            <div
              key={index}
              className={`
                relative flex items-center justify-center
                text-xs transition-all duration-150 rounded-lg cursor-default aspect-square
                ${dayData.isCurrentMonth
                  ? 'text-[var(--color-fg)]'
                  : 'text-[var(--color-muted)]/40'
                }
                ${isToday
                  ? 'bg-[var(--color-muted)]/15'
                  : ''
                }
                ${hasEvents ? 'cursor-pointer hover:bg-[var(--color-surface-hover)]' : ''}
              `}
              onMouseEnter={() => hasEvents && setHoveredDate(dayData.date)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              {/* Date number */}
              <span
                className={`
                  leading-none font-medium
                  ${isToday ? 'font-semibold' : ''}
                `}
              >
                {dayData.day}
              </span>

              {/* Event icons - bottom right corner, slightly overlapping */}
              {renderEventIndicator(streams, isPastDate)}

              {/* Hover Tooltip */}
              {isHovered && hasEvents && (
                <div
                  className="absolute z-50 bottom-full left-1/2 mb-2 pointer-events-none"
                  style={{
                    minWidth: '160px',
                    transform: 'translateX(-50%)',
                    animation: 'tooltipPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                  }}
                >
                  <style jsx>{`
                    @keyframes tooltipPop {
                      0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(4px) scale(0.95);
                      }
                      100% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                      }
                    }
                  `}</style>
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl p-2.5">
                    {/* Date header */}
                    <div className="text-[10px] font-medium text-[var(--color-muted)] mb-2">
                      {formatDateForTooltip(dayData.date)}
                    </div>

                    {/* Recurring items */}
                    <div className="space-y-1.5">
                      {streams.map((stream, idx) => (
                        <div key={stream.id || idx} className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                            style={{
                              backgroundColor: (!DISABLE_LOGOS && stream.icon_url && stream.merchant_name)
                                ? 'transparent'
                                : (stream.category_hex_color || 'var(--color-accent)'),
                            }}
                          >
                            {(!DISABLE_LOGOS && stream.icon_url && stream.merchant_name) ? (
                              <img
                                src={stream.icon_url}
                                alt=""
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              <DynamicIcon
                                iconLib={stream.category_icon_lib}
                                iconName={stream.category_icon_name}
                                className="w-2.5 h-2.5 text-white"
                                fallback={FiTag}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-[var(--color-fg)] truncate max-w-[150px]">
                              {stream.merchant_name || stream.description}
                            </div>
                          </div>
                          <div className={`text-[11px] font-semibold tabular-nums ${stream.stream_type === 'inflow' ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
                            {stream.stream_type === 'inflow' ? '+' : ''}{formatCurrency(stream.last_amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Loading state overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[var(--color-surface)]/50 flex items-center justify-center rounded-xl">
          <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
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
            // Sort by date (next due)
            const dateA = a.predicted_next_date || a.last_date;
            const dateB = b.predicted_next_date || b.last_date;
            return new Date(dateA) - new Date(dateB);
          }).map((stream, idx) => (
            <div key={stream.id || idx} className="flex items-center gap-3 p-3 hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors">
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
              No recurring transactions found
            </div>
          )}
        </div>
      </Drawer>
    </Card>
  );
}
