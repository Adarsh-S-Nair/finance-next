"use client";

import PageContainer from "../../../components/layout/PageContainer";
import Button from "../../../components/ui/Button";
import DynamicIcon from "../../../components/DynamicIcon";
import Drawer from "../../../components/ui/Drawer";
import SelectCategoryView from "../../../components/SelectCategoryView";
import Card from "../../../components/ui/Card";
import { FiRefreshCw, FiFilter, FiSearch, FiTag, FiLoader, FiChevronDown, FiChevronUp, FiX, FiDollarSign, FiCalendar, FiTrendingUp, FiTrendingDown, FiClock, FiAlertCircle } from "react-icons/fi";
import { LuReceipt } from "react-icons/lu";
import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, useTransition, memo, Suspense } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../../../components/providers/UserProvider";
import Input from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabase/client";
import { authFetch } from "../../../lib/api/fetch";

import TransactionDetails from "../../../components/transactions/TransactionDetails";
import SimilarTransactionsFound from "../../../components/transactions/SimilarTransactionsFound";
import TransactionRow from "../../../components/transactions/TransactionRow";
import SplitTransactionView from "../../../components/transactions/SplitTransactionView";
import RepaymentView from "../../../components/transactions/RepaymentView";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';


const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// TransactionSkeleton component for loading state
function TransactionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[...Array(3)].map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          {/* Date Header Skeleton */}
          <div className="py-2 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
            <div className="h-4 bg-[var(--color-border)] rounded w-32" />
          </div>

          {/* Transaction Rows Skeleton */}
          <div className="space-y-0">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className={`flex items-center justify-between py-4 px-1 ${index < 3 ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]' : ''
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Icon Circle Skeleton */}
                  <div className="w-10 h-10 bg-[var(--color-border)] rounded-full flex-shrink-0" />

                  {/* Text Content Skeleton */}
                  <div className="min-w-0 flex-1 mr-8">
                    <div className="h-4 bg-[var(--color-border)] rounded w-32 mb-2" />
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-[var(--color-border)] rounded-full" />
                      <div className="h-3 bg-[var(--color-border)] rounded w-20" />
                    </div>
                  </div>
                </div>

                {/* Amount Skeleton */}
                <div className="text-right flex-shrink-0">
                  <div className="h-4 bg-[var(--color-border)] rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// SearchToolbar — portals into topbar on all screen sizes
function SearchToolbar({ searchQuery, setSearchQuery, onRefresh, loading, onOpenFilters, activeFilterCount }) {
  const [mounted, setMounted] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileInputRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  const handleMobileBlur = () => {
    if (!searchQuery.trim()) {
      setMobileSearchOpen(false);
    }
  };

  const toolButtons = (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh"
        className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50"
      >
        <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={onOpenFilters}
        aria-label="Filter"
        className="relative w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors"
      >
        <FiFilter className="h-4 w-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>
    </div>
  );

  // Desktop topbar content — search on left, tools right-aligned
  const desktopContent = (
    <div className="flex items-center w-full">
      <div className="max-w-sm w-full flex items-center gap-2 pb-1 input-focus-bar">
        <FiSearch className="pointer-events-none h-4 w-4 text-[var(--color-muted)] flex-shrink-0" />
        <input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-base text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none"
        />
      </div>
      <div className="ml-auto">
        {toolButtons}
      </div>
    </div>
  );

  const portalRoot = mounted ? document.getElementById("page-title-portal") : null;
  const mobilePortalRoot = mounted ? document.getElementById("page-mobile-start-portal") : null;

  return (
    <>
      {/* Desktop: portal into topbar title area */}
      {portalRoot && createPortal(desktopContent, portalRoot)}

      {/* Mobile: search icon portaled into topbar */}
      {mobilePortalRoot && createPortal(
        <button
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Search"
          className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          <FiSearch className="h-5 w-5" />
        </button>,
        mobilePortalRoot
      )}

      {/* Mobile: expanded search overlay — covers the topbar */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-0 top-0 z-50 h-16 bg-[var(--color-content-bg)] flex items-center px-4 gap-3 md:hidden"
          >
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-shrink-0"
              aria-label="Close search"
            >
              <span className="text-lg leading-none">&#8249;</span>
            </button>
            <input
              ref={mobileInputRef}
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={handleMobileBlur}
              className="flex-1 bg-transparent text-base text-[var(--color-fg)] placeholder:text-[var(--color-muted)] outline-none"
            />
            {toolButtons}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// TransactionList component to avoid runtime errors
const TransactionList = memo(function TransactionList({ transactions, onTransactionClick, isSearching }) {
  const formatDateHeader = (dateString) => {
    if (!dateString) return 'Unknown Date';

    // Parse the date string (which is UTC)
    const date = new Date(dateString);
    const now = new Date();

    // Get UTC components from the transaction date
    const txYear = date.getUTCFullYear();
    const txMonth = date.getUTCMonth();
    const txDay = date.getUTCDate();

    // Get local components from current date
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();

    // Create comparable date objects set to midnight local time
    const txDateLocal = new Date(txYear, txMonth, txDay);
    const nowDateLocal = new Date(nowYear, nowMonth, nowDay);

    const diffTime = nowDateLocal - txDateLocal;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Check if it's today
    if (diffDays === 0) {
      return 'Today';
    }

    // Check if it's yesterday
    if (diffDays === 1) {
      return 'Yesterday';
    }

    // For other dates, show the formatted date using UTC timezone
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  };

  // Memoize expensive grouping operation
  const { grouped, sortedDates } = useMemo(() => {
    const grouped = {};

    transactions.forEach(transaction => {
      // Use the explicit date column if available, otherwise fall back to datetime
      // Both are stored/treated as UTC, so toDateString() on a Date object created from them works
      // provided we treat them as UTC dates.
      // Actually, new Date("2025-11-28") is UTC. new Date("2025-11-28T00:00:00Z") is UTC.
      // So toDateString() returns local date string "Thu Nov 27 2025" if in EST.
      // We want the UTC date string.

      const dateStr = transaction.date || transaction.datetime;
      let dateKey = 'Unknown';

      if (dateStr) {
        const d = new Date(dateStr);
        // Format as YYYY-MM-DD to ensure consistent grouping key
        dateKey = d.toISOString().split('T')[0];
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(transaction);
    });

    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return new Date(b) - new Date(a);
    });

    return { grouped, sortedDates };
  }, [transactions]);

  return (
    <div className="space-y-6 pb-24 animate-fade-in pl-1">
      {sortedDates.map((dateKey, groupIndex) => (
        <div key={dateKey} className="relative">
          <div className="sticky top-16 z-20 py-4 pointer-events-none">
            <div className="px-4 md:px-5">
              <span className="text-sm font-medium text-[var(--color-muted)]">
                {formatDateHeader(dateKey === 'Unknown' ? null : dateKey)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {grouped[dateKey].map((transaction, index) => (
              <TransactionRow
                key={`${transaction.id}-${dateKey}-${index}`}
                transaction={transaction}
                onTransactionClick={onTransactionClick}
                index={index}
                groupIndex={groupIndex}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

// Add display name for debugging
TransactionList.displayName = 'TransactionList';



// Minimal segmented control
const FilterSelector = ({ options, value, onChange, label }) => {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">{label}</label>
      <div className="flex bg-[var(--color-surface-alt)] rounded-md p-0.5">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                isActive
                  ? 'bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Section label helper
const SectionLabel = ({ children, count }) => (
  <div className="flex items-center justify-between">
    <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </label>
    {count > 0 && (
      <span className="text-[10px] font-medium text-[var(--color-muted)] tabular-nums">
        {count} selected
      </span>
    )}
  </div>
);

// Extracted Filters Content Component to reuse in both render paths
const FiltersContent = ({
  transactionType, setTransactionType,
  transactionStatus, setTransactionStatus,
  amountRange, setAmountRange,
  dateRange, setDateRange,
  customDateRange, setCustomDateRange,
  selectedGroupIds, selectedCategoryIds,
  toggleGroup, toggleCategory, toggleGroupExpand,
  expandedGroups, categoryGroups,
  loadingCategoryGroups, categoryGroupsError,
  activeFilterCount = 0, onClearAll
}) => {
  const [categorySearch, setCategorySearch] = useState("");

  // Filter categories based on search
  const filteredCategoryGroups = useMemo(() => {
    if (!categorySearch.trim()) return categoryGroups;

    const query = categorySearch.toLowerCase();
    return categoryGroups
      .map(group => {
        const groupMatches = group.name.toLowerCase().includes(query);
        const matchingChildren = group.system_categories?.filter(cat =>
          cat.label.toLowerCase().includes(query)
        );

        if (groupMatches) {
          return group;
        } else if (matchingChildren?.length > 0) {
          return {
            ...group,
            system_categories: matchingChildren
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [categoryGroups, categorySearch]);

  // Auto-expand groups when searching
  useEffect(() => {
    if (categorySearch.trim()) {
      filteredCategoryGroups.forEach(group => {
        if (!expandedGroups[group.id]) {
          toggleGroupExpand(group.id);
        }
      });
    }
  }, [categorySearch, filteredCategoryGroups]);

  const dateOptions = [
    { value: 'all', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: '30days', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom' },
  ];

  const totalCategorySelections = selectedGroupIds.length + selectedCategoryIds.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-1 py-2 space-y-7">
      {/* Reset link */}
      {activeFilterCount > 0 && onClearAll && (
        <div className="flex items-center justify-between -mb-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {activeFilterCount} active
          </span>
          <button
            onClick={onClearAll}
            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Reset all
          </button>
        </div>
      )}

      {/* Type */}
      <FilterSelector
        label="Type"
        value={transactionType}
        onChange={setTransactionType}
        options={[
          { value: 'all', label: 'All' },
          { value: 'income', label: 'Income' },
          { value: 'expense', label: 'Expense' }
        ]}
      />

      {/* Status */}
      <FilterSelector
        label="Status"
        value={transactionStatus}
        onChange={setTransactionStatus}
        options={[
          { value: 'all', label: 'All' },
          { value: 'completed', label: 'Completed' },
          { value: 'pending', label: 'Pending' },
          { value: 'attention', label: 'Attention' }
        ]}
      />

      {/* Amount */}
      <div className="space-y-2">
        <SectionLabel>Amount</SectionLabel>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Min"
              value={amountRange.min}
              onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
              className="w-full pl-6 pr-2 py-2 text-xs bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
            />
          </div>
          <span className="text-xs text-[var(--color-muted)]">to</span>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Max"
              value={amountRange.max}
              onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
              className="w-full pl-6 pr-2 py-2 text-xs bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
            />
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <SectionLabel>Date</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {dateOptions.map((option) => {
            const isActive = dateRange === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
              className="flex-1 py-2 px-2 text-xs bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
            />
            <span className="text-xs text-[var(--color-muted)]">to</span>
            <input
              type="date"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
              className="flex-1 py-2 px-2 text-xs bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
            />
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <SectionLabel count={totalCategorySelections}>Categories</SectionLabel>

        {/* Category Search */}
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Search categories"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
          />
        </div>

        <div className="pt-1">
          {loadingCategoryGroups ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="flex items-center gap-2.5 py-2">
                  <div className="w-5 h-5 rounded bg-[var(--color-surface-alt)] animate-pulse" />
                  <div className="h-3 w-24 bg-[var(--color-surface-alt)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : categoryGroupsError ? (
            <div className="py-3 text-xs text-[var(--color-muted)]">{categoryGroupsError}</div>
          ) : filteredCategoryGroups.length === 0 ? (
            <div className="py-3 text-xs text-[var(--color-muted)]">No categories found</div>
          ) : (
            <div>
              {filteredCategoryGroups.map((group) => {
                const isGroupSelected = selectedGroupIds.includes(group.id);
                const isExpanded = !!expandedGroups[group.id];
                const selectedChildCount = group.system_categories?.filter(c => selectedCategoryIds.includes(c.id)).length || 0;
                const totalChildCount = group.system_categories?.length || 0;
                const isPartiallySelected = selectedChildCount > 0 && selectedChildCount < totalChildCount;
                const isFullySelected = isGroupSelected || (totalChildCount > 0 && selectedChildCount === totalChildCount);

                return (
                  <div key={group.id}>
                    {/* Group Row */}
                    <div className="flex items-center gap-2 py-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(group.id);
                        }}
                        aria-label={`Toggle ${group.name}`}
                        className={`w-4 h-4 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-colors ${
                          isFullySelected
                            ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                            : isPartiallySelected
                              ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                              : 'border border-[var(--color-border)] hover:border-[var(--color-muted)]'
                        }`}
                      >
                        {isFullySelected && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {!isFullySelected && isPartiallySelected && (
                          <div className="w-2 h-[1.5px] bg-current rounded-full" />
                        )}
                      </button>

                      <button
                        onClick={() => toggleGroupExpand(group.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left py-1 -my-1"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.hex_color || 'var(--color-muted)' }}
                        />
                        <span className="text-xs font-medium text-[var(--color-fg)] truncate flex-1">
                          {group.name}
                        </span>
                        {selectedChildCount > 0 && !isGroupSelected && (
                          <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                            {selectedChildCount}/{totalChildCount}
                          </span>
                        )}
                        <FiChevronDown
                          className={`w-3.5 h-3.5 text-[var(--color-muted)] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>

                    {/* Children */}
                    <AnimatePresence initial={false}>
                      {isExpanded && group.system_categories && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pl-6 pb-1">
                            {group.system_categories.map((category) => {
                              const isCatSelected = selectedCategoryIds.includes(category.id) || isGroupSelected;
                              return (
                                <button
                                  key={category.id}
                                  onClick={() => toggleCategory(category.id)}
                                  disabled={isGroupSelected}
                                  className="flex items-center gap-2 w-full py-1.5 text-left disabled:opacity-60"
                                >
                                  <div
                                    className={`w-4 h-4 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-colors ${
                                      isCatSelected
                                        ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
                                        : 'border border-[var(--color-border)]'
                                    }`}
                                  >
                                    {isCatSelected && (
                                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                        <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className={`text-xs ${isCatSelected ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>
                                    {category.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function TransactionsContent() {
  const { user, profile } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get('search') || "");
  const [isPending, startTransition] = useTransition();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentDrawerView, setCurrentDrawerView] = useState('transaction-details');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [loadingCategoryGroups, setLoadingCategoryGroups] = useState(false);
  const [categoryGroupsError, setCategoryGroupsError] = useState(null);
  const [similarTransactionsCount, setSimilarTransactionsCount] = useState(0);
  const [similarTransactions, setSimilarTransactions] = useState([]);
  const [matchCriteria, setMatchCriteria] = useState(null);
  const [pendingCategory, setPendingCategory] = useState(null);

  // Filter states initialized from URL
  const [selectedGroupIds, setSelectedGroupIds] = useState(() =>
    searchParams.get('groupIds')?.split(',').filter(Boolean) || []
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() =>
    searchParams.get('categoryIds')?.split(',').filter(Boolean) || []
  );
  const [amountRange, setAmountRange] = useState(() => ({
    min: searchParams.get('minAmount') || '',
    max: searchParams.get('maxAmount') || ''
  }));

  const [dateRange, setDateRange] = useState(() => {
    const range = searchParams.get('dateRange');
    if (range) return range;
    if (searchParams.get('startDate') || searchParams.get('endDate')) return 'custom';
    return 'all';
  });

  const [customDateRange, setCustomDateRange] = useState(() => ({
    start: searchParams.get('startDate') || '',
    end: searchParams.get('endDate') || ''
  }));

  const [transactionType, setTransactionType] = useState(() =>
    searchParams.get('type') || 'all'
  );
  const [transactionStatus, setTransactionStatus] = useState(() =>
    searchParams.get('status') || 'all'
  );

  // Sync state changes to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
    if (transactionType !== 'all') params.set('type', transactionType);
    if (transactionStatus !== 'all') params.set('status', transactionStatus);
    if (amountRange.min) params.set('minAmount', amountRange.min);
    if (amountRange.max) params.set('maxAmount', amountRange.max);
    if (selectedGroupIds.length > 0) params.set('groupIds', selectedGroupIds.join(','));
    if (selectedCategoryIds.length > 0) params.set('categoryIds', selectedCategoryIds.join(','));

    if (dateRange !== 'all') {
      params.set('dateRange', dateRange);
      if (dateRange === 'custom') {
        if (customDateRange.start) params.set('startDate', customDateRange.start);
        if (customDateRange.end) params.set('endDate', customDateRange.end);
      }
    }

    // Only update if the params string has changed to avoid loops/redundant pushes
    const newSearch = params.toString();
    const currentSearch = searchParams.toString();

    if (newSearch !== currentSearch) {
      router.push(`${pathname}?${newSearch}`, { scroll: false });
    }
  }, [
    debouncedSearchQuery,
    transactionType,
    transactionStatus,
    amountRange,
    dateRange,
    customDateRange,
    selectedGroupIds,
    selectedCategoryIds,
    pathname,
    router,
    searchParams
  ]);

  const [nextCursor, setNextCursor] = useState(null);
  const [prevCursor, setPrevCursor] = useState(null);

  const PAGE_LIMIT = 20;
  const MAX_ITEMS = 50; // Maximum number of items to keep in DOM
  const initialAbortRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const containerRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const isPrependRef = useRef(false);

  // Fetch transactions helper
  const fetchTransactionsData = async (cursor = null, direction = 'forward') => {
    if (!user?.id) return null;

    const params = new URLSearchParams({
      limit: PAGE_LIMIT.toString(),
      minimal: '1',
      direction
    });

    if (cursor) {
      params.append('cursorDate', cursor.date);
      params.append('cursorId', cursor.id);
    }

    // Add search parameter if it exists
    if (debouncedSearchQuery && debouncedSearchQuery.trim().length > 0) {
      params.append('search', debouncedSearchQuery.trim());
    }

    // Add filter parameters
    if (transactionType !== 'all') {
      params.append('type', transactionType);
    }

    if (transactionStatus !== 'all') {
      params.append('status', transactionStatus);
    }

    if (amountRange.min !== '') {
      params.append('minAmount', amountRange.min);
    }
    if (amountRange.max !== '') {
      params.append('maxAmount', amountRange.max);
    }

    if (selectedGroupIds.length > 0) {
      params.append('groupIds', selectedGroupIds.join(','));
    }
    if (selectedCategoryIds.length > 0) {
      params.append('categoryIds', selectedCategoryIds.join(','));
    }

    // Date filtering
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate, endDate;

      if (dateRange === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
      } else if (dateRange === 'week') {
        const firstDayOfWeek = now.getDate() - now.getDay();
        startDate = new Date(now.setDate(firstDayOfWeek));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
      } else if (dateRange === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (dateRange === '30days') {
        startDate = new Date(now.setDate(now.getDate() - 30));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
      } else if (dateRange === 'custom') {
        if (customDateRange.start) {
          startDate = new Date(customDateRange.start);
          startDate.setHours(0, 0, 0, 0);
        }
        if (customDateRange.end) {
          endDate = new Date(customDateRange.end);
          endDate.setHours(23, 59, 59, 999);
        }
      }

      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
    }

    const response = await authFetch(`/api/plaid/transactions/get?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return await response.json();
  };

  // Initial fetch
  const fetchInitialTransactions = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      if (initialAbortRef.current) initialAbortRef.current.abort();

      const data = await fetchTransactionsData();
      setTransactions(data.transactions || []);
      setNextCursor(data.nextCursor);
      setPrevCursor(data.prevCursor); // Usually null for initial fetch unless we started in middle
      return data.transactions;
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, sync all Plaid items
      const response = await authFetch('/api/plaid/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Sync failed:', errorData);
        // Continue to refetch even if sync fails
      } else {
        const syncResult = await response.json();
        console.log('Sync completed:', syncResult);
      }
    } catch (error) {
      console.error('Error during sync:', error);
      // Continue to refetch even if sync fails
    }

    // Then refetch transactions from database
    await refreshLocalData();
  };

  // Skip the full sync and only fetch from DB
  const refreshLocalData = async () => {
    setTransactions([]);
    setNextCursor(null);
    setPrevCursor(null);
    // Don't clear search query to maintain context
    return await fetchInitialTransactions();
  };

  // Load more (next page - older transactions)
  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      const data = await fetchTransactionsData(nextCursor, 'forward');

      if (data.transactions.length > 0) {
        setTransactions(prev => {
          const newTransactions = [...prev, ...data.transactions];
          // Windowing: Remove from top if too many
          if (newTransactions.length > MAX_ITEMS) {
            const overflow = newTransactions.length - MAX_ITEMS;
            const keptTransactions = newTransactions.slice(overflow);
            // Update prevCursor to the first item of the new list
            setPrevCursor({
              date: keptTransactions[0].date,
              id: keptTransactions[0].id
            });
            return keptTransactions;
          }
          return newTransactions;
        });
        setNextCursor(data.nextCursor);
      } else {
        setNextCursor(null); // End of list
      }
    } catch (err) {
      console.error('Error loading more:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, user?.id, transactionType, transactionStatus, amountRange, dateRange, customDateRange, selectedGroupIds, selectedCategoryIds, debouncedSearchQuery]);

  // Load previous (prev page - newer transactions)
  const loadPrev = useCallback(async () => {
    if (loadingPrev || !prevCursor) return;

    try {
      setLoadingPrev(true);
      // Capture current scroll height before adding items
      prevScrollHeightRef.current = document.documentElement.scrollHeight;
      isPrependRef.current = true;

      const data = await fetchTransactionsData(prevCursor, 'backward');

      if (data.transactions.length > 0) {
        setTransactions(prev => {
          const newTransactions = [...data.transactions, ...prev];
          // Windowing: Remove from bottom if too many
          if (newTransactions.length > MAX_ITEMS) {
            const keptTransactions = newTransactions.slice(0, MAX_ITEMS);
            // Update nextCursor to the last item of the new list
            setNextCursor({
              date: keptTransactions[keptTransactions.length - 1].date,
              id: keptTransactions[keptTransactions.length - 1].id
            });
            return keptTransactions;
          }
          return newTransactions;
        });
        setPrevCursor(data.prevCursor);
      } else {
        setPrevCursor(null); // Start of list
        isPrependRef.current = false; // Nothing added, no need to adjust
      }
    } catch (err) {
      console.error('Error loading prev:', err);
      isPrependRef.current = false;
    } finally {
      setLoadingPrev(false);
    }
  }, [loadingPrev, prevCursor, user?.id, transactionType, transactionStatus, amountRange, dateRange, customDateRange, selectedGroupIds, selectedCategoryIds, debouncedSearchQuery]);

  // Restore scroll position after prepending items
  useLayoutEffect(() => {
    if (isPrependRef.current) {
      const currentScrollHeight = document.documentElement.scrollHeight;
      const diff = currentScrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        window.scrollBy(0, diff);
      }
      isPrependRef.current = false;
    }
  }, [transactions]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === bottomSentinelRef.current) {
              loadMore();
            } else if (entry.target === topSentinelRef.current) {
              loadPrev();
            }
          }
        });
      },
      { rootMargin: '400px' } // Load before reaching the edge
    );

    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);
    if (topSentinelRef.current) observer.observe(topSentinelRef.current);

    return () => observer.disconnect();
  }, [loadMore, loadPrev]);

  useEffect(() => {
    fetchInitialTransactions();
    return () => {
      if (initialAbortRef.current) initialAbortRef.current.abort();
    };
  }, [user?.id, debouncedSearchQuery, transactionType, transactionStatus, amountRange, dateRange, customDateRange, selectedGroupIds, selectedCategoryIds]); // Re-fetch when ANY filter changes

  // Debounce search query with transition for non-blocking updates
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearchQuery(searchQuery);
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load category groups when opening Filters (once per session)
  useEffect(() => {
    const loadCategoryGroups = async () => {
      try {
        setLoadingCategoryGroups(true);
        setCategoryGroupsError(null);
        const { data, error } = await supabase
          .from('category_groups')
          .select('id, name, icon_lib, icon_name, hex_color, system_categories(id, label, hex_color)')
          .order('name', { ascending: true });

        if (error) throw error;

        // Sort categories within groups
        const groups = (data || []).map(group => ({
          ...group,
          system_categories: (group.system_categories || []).sort((a, b) => a.label.localeCompare(b.label))
        }));

        setCategoryGroups(groups);
      } catch (e) {
        console.error('Failed to load category groups', e);
        setCategoryGroupsError('Failed to load categories');
      } finally {
        setLoadingCategoryGroups(false);
      }
    };
    if ((isFiltersOpen || (isDrawerOpen && currentDrawerView === 'select-category')) && categoryGroups.length === 0 && !loadingCategoryGroups) {
      loadCategoryGroups();
    }
  }, [isFiltersOpen, isDrawerOpen, currentDrawerView, categoryGroups.length, loadingCategoryGroups]);

  // Calculate active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedGroupIds.length > 0) count++;
    if (selectedCategoryIds.length > 0) count++;
    if (amountRange.min !== '' || amountRange.max !== '') count++;
    if (dateRange !== 'all') count++;
    if (transactionType !== 'all') count++;
    if (transactionStatus !== 'all') count++;
    return count;
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedGroupIds([]);
    setSelectedCategoryIds([]);
    setAmountRange({ min: '', max: '' });
    setDateRange('all');
    setCustomDateRange({ start: '', end: '' });
    setTransactionType('all');
    setTransactionStatus('all');
  };

  // Toggle group selection
  const toggleGroup = (groupId) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Toggle category selection
  const toggleCategory = (categoryId) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // State for expanded groups in filter view
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleTransactionClick = (transaction) => {
    setTransactionHistory([]);
    setSelectedTransaction(transaction);
    setIsDrawerOpen(true);
    setCurrentDrawerView('transaction-details');
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedTransaction(null);
    setCurrentDrawerView('transaction-details');
    setPendingCategory(null); // Reset pending category selection
  };

  const handleCategoryClick = () => {
    // Reset pending category when opening select-category view fresh
    setPendingCategory(null);
    setCurrentDrawerView('select-category');
  };

  const handleBackToTransaction = () => {
    if (currentDrawerView !== 'transaction-details') {
      // If going back from select-category view, reset pending category
      if (currentDrawerView === 'select-category') {
        setPendingCategory(null);
      }
      setCurrentDrawerView('transaction-details');
      return;
    }

    if (transactionHistory.length > 0) {
      const prev = transactionHistory[transactionHistory.length - 1];
      setTransactionHistory(prev => prev.slice(0, -1));
      setSelectedTransaction(prev);
    }
  };

  const handleTransactionLinkClick = (transactionId) => {
    // Find in currently loaded transactions
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      setTransactionHistory(prev => [...prev, selectedTransaction]);
      setSelectedTransaction(transaction);
      setCurrentDrawerView('transaction-details');
    } else {
      console.log('Transaction not found in local list:', transactionId);
      // In a real app we might fetch it here, but for now we rely on local
    }
  };

  const handleSplitClick = () => {
    setCurrentDrawerView('split-transaction');
  };

  const handleRepaymentClick = () => {
    setCurrentDrawerView('allocate-repayment');
  };

  const handleSimilarTransactionsClose = () => {
    setIsDrawerOpen(false);
    setSelectedTransaction(null);
    setCurrentDrawerView('transaction-details');
    setSimilarTransactionsCount(0);
    setPendingCategory(null); // Clear pending category on similar transactions close
  };

  const [detectingSimilar, setDetectingSimilar] = useState(false);

  const handleCategorySelect = async (category) => {
    if (!selectedTransaction) return;

    // 1. Check for similar transactions FIRST
    try {
      setDetectingSimilar(true);
      const response = await authFetch('/api/transactions/detect-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          categoryId: category.id,
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.count > 0) {
          // Found similar transactions!
          // Store the category we WANT to apply, but don't apply it yet.
          setPendingCategory(category);
          setSimilarTransactionsCount(data.count);
          setSimilarTransactions(data.transactions);
          setMatchCriteria(data.criteria);
          setCurrentDrawerView('similar-transactions');
          setIsDrawerOpen(true);
          return; // STOP HERE. Don't update DB yet.
        }
      }
    } catch (err) {
      console.error('Error detecting similar transactions:', err);
      // Fall through to normal update if detection fails
    } finally {
      setDetectingSimilar(false);
    }

    // 2. If no similar transactions (or error), proceed with immediate update
    await updateTransactionCategory(category);
  };

  const updateTransactionCategory = async (category) => {
    // Find the group for this category to get the color/icon
    const group = categoryGroups.find(g => g.system_categories.some(c => c.id === category.id));

    // Optimistic update
    const updatedTransaction = {
      ...selectedTransaction,
      category_id: category.id,
      category_name: category.label,
      category_hex_color: group?.hex_color,
      category_icon_lib: group?.icon_lib,
      category_icon_name: group?.icon_name
    };

    setSelectedTransaction(updatedTransaction);
    setTransactions(prev => prev.map(t => t.id === selectedTransaction.id ? updatedTransaction : t));
    setCurrentDrawerView('transaction-details');
    setPendingCategory(null); // Clear pending

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: category.id })
        .eq('id', selectedTransaction.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating category:', err);
      // Revert logic could go here
    }
  };

  const handleConfirmRule = async (selectedIds, rules) => {
    if (pendingCategory) {
      // 1. Update the original transaction (always)
      await updateTransactionCategory(pendingCategory);

      // 2. Update similar transactions if selected
      if (selectedIds && selectedIds.length > 0) {
        try {
          // Find the group for this category to get the color/icon
          const group = categoryGroups.find(g => g.system_categories.some(c => c.id === pendingCategory.id));

          // Optimistic update for similar transactions in the list
          setTransactions(prev => prev.map(t =>
            selectedIds.includes(t.id)
              ? {
                ...t,
                category_id: pendingCategory.id,
                category_name: pendingCategory.label,
                category_hex_color: group?.hex_color,
                category_icon_lib: group?.icon_lib,
                category_icon_name: group?.icon_name
              }
              : t
          ));

          const { error } = await supabase
            .from('transactions')
            .update({ category_id: pendingCategory.id })
            .in('id', selectedIds);

          if (error) throw error;
        } catch (err) {
          console.error('Error updating similar transactions:', err);
        }
      }

      // 3. Create the category rule
      if (rules && rules.length > 0) {
        try {
          // Clean up rules to remove internal IDs before saving
          const conditions = rules.map(({ field, operator, value }) => ({
            field,
            operator,
            value
          }));

          const { error } = await supabase
            .rpc('upsert_category_rule', {
              p_user_id: user.id,
              p_category_id: pendingCategory.id,
              p_conditions: conditions
            });

          if (error) throw error;
          console.log('Category rule upserted successfully');
        } catch (err) {
          console.error('Error creating category rule:', err);
        }
      }

      setIsDrawerOpen(false); // Close drawer after confirming
    }
  };

  const handleCategorizeOnly = async () => {
    if (pendingCategory) {
      await updateTransactionCategory(pendingCategory);
      setIsDrawerOpen(false);
    }
  };

  const handleEditCategory = () => {
    setCurrentDrawerView('select-category');
  };

  // Use transactions directly since they are now server-filtered
  const filteredTransactions = transactions;

  // Show loading state with smooth transition
  const isSearchLoading = isPending || loading;

  if ((loading && !debouncedSearchQuery) || !user?.id) {
    return (
      <PageContainer padding="pt-2 pb-10" showHeader={false}>
        <SearchToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          loading={isSearchLoading}
          onOpenFilters={() => setIsFiltersOpen(true)}
          activeFilterCount={getActiveFilterCount()}
        />
        <TransactionSkeleton />

        {/* Filters Drawer */}
        <Drawer
          isOpen={isFiltersOpen}
          onClose={() => setIsFiltersOpen(false)}
          title="Filters"
          size="md"
        >
          <FiltersContent
            transactionType={transactionType}
            setTransactionType={setTransactionType}
            transactionStatus={transactionStatus}
            setTransactionStatus={setTransactionStatus}
            amountRange={amountRange}
            setAmountRange={setAmountRange}
            dateRange={dateRange}
            setDateRange={setDateRange}
            customDateRange={customDateRange}
            setCustomDateRange={setCustomDateRange}
            selectedGroupIds={selectedGroupIds}
            selectedCategoryIds={selectedCategoryIds}
            toggleGroup={toggleGroup}
            toggleCategory={toggleCategory}
            toggleGroupExpand={toggleGroupExpand}
            expandedGroups={expandedGroups}
            categoryGroups={categoryGroups}
            loadingCategoryGroups={loadingCategoryGroups}
            categoryGroupsError={categoryGroupsError}
            activeFilterCount={getActiveFilterCount()}
            onClearAll={handleClearAllFilters}
          />
        </Drawer>
      </PageContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <PageContainer padding="pt-2 pb-10" showHeader={false}>
        <SearchToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          loading={isSearchLoading}
          onOpenFilters={() => setIsFiltersOpen(true)}
          activeFilterCount={getActiveFilterCount()}
        />
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-danger),transparent_90%)] rounded-full flex items-center justify-center mb-4">
            <LuReceipt className="h-8 w-8 text-[var(--color-danger)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Error loading transactions</h3>
          <p className="text-[var(--color-muted)] mb-4">{error}</p>
          <Button onClick={fetchInitialTransactions}>
            Try Again
          </Button>
        </div>
      </PageContainer>
    );
  }

  const handleDeleteSplit = async (splitId) => {
    // Optimistic update
    if (selectedTransaction) {
      const updatedTx = {
        ...selectedTransaction,
        transaction_splits: selectedTransaction.transaction_splits?.filter(s => s.id !== splitId) || []
      };
      setSelectedTransaction(updatedTx);
    }

    try {
      const { error } = await supabase
        .from('transaction_splits')
        .delete()
        .eq('id', splitId);

      if (error) {
        console.error('Error deleting split:', error);
        return;
      }

      const newTransactions = await refreshLocalData();
      // Ensure we have the latest server state, though optimistic update handled the UI
      if (selectedTransaction && newTransactions) {
        const updated = newTransactions.find(t => t.id === selectedTransaction.id);
        if (updated) setSelectedTransaction(updated);
      }
    } catch (error) {
      console.error('Error deleting split:', error);
    }
  };

  const handleSplitCreated = async () => {
    const newTransactions = await refreshLocalData();
    if (selectedTransaction && newTransactions) {
      const updated = newTransactions.find(t => t.id === selectedTransaction.id);
      if (updated) setSelectedTransaction(updated);
    }
    handleBackToTransaction();
  };

  const handleRepaymentCreated = async () => {
    const newTransactions = await refreshLocalData();
    if (selectedTransaction && newTransactions) {
      const updated = newTransactions.find(t => t.id === selectedTransaction.id);
      if (updated) setSelectedTransaction(updated);
    }
    handleBackToTransaction();
  };

  return (
    <PageContainer padding="pt-2 pb-10" showHeader={false}>
      <SearchToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={handleRefresh}
        loading={isSearchLoading}
        onOpenFilters={() => setIsFiltersOpen(true)}
        activeFilterCount={getActiveFilterCount()}
      />
      <div className="space-y-0" ref={containerRef}>
        {/* Top Sentinel for scrolling up */}
        <div ref={topSentinelRef} className="h-4 w-full flex justify-center items-center">
          {loadingPrev && <FiLoader className="animate-spin text-[var(--color-muted)]" />}
        </div>

        {/* Show empty state if no transactions */}
        {filteredTransactions.length === 0 && !isSearchLoading ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              {debouncedSearchQuery || getActiveFilterCount() > 0 ? (
                <FiSearch className="h-8 w-8 text-[var(--color-muted)]" />
              ) : (
                <LuReceipt className="h-8 w-8 text-[var(--color-muted)]" />
              )}
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">
              {debouncedSearchQuery || getActiveFilterCount() > 0 ? 'No transactions found' : 'No transactions found'}
            </h3>
            <p className="text-[var(--color-muted)] mb-4">
              {debouncedSearchQuery
                ? `No transactions match "${debouncedSearchQuery}". Try a different search term.`
                : getActiveFilterCount() > 0
                  ? 'No transactions match your current filters. Try adjusting or clearing them.'
                  : 'Connect your bank accounts to see your financial activity'}
            </p>
            {(debouncedSearchQuery || getActiveFilterCount() > 0) && (
              <div className="flex gap-2 justify-center">
                {debouncedSearchQuery && (
                  <Button onClick={() => { setSearchQuery(""); setDebouncedSearchQuery(""); }} variant="outline">
                    Clear Search
                  </Button>
                )}
                {getActiveFilterCount() > 0 && (
                  <Button onClick={handleClearAllFilters} variant="outline">
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div data-transaction-list className="relative">
            {/* Search Loading Overlay */}
            {isPending && (
              <div className="absolute inset-0 z-10 bg-[var(--color-bg)]/50 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                <div className="flex flex-col items-center gap-3">
                  <FiLoader className="animate-spin text-[var(--color-accent)] h-8 w-8" />
                  <p className="text-sm text-[var(--color-muted)]">Searching...</p>
                </div>
              </div>
            )}
            <TransactionList
              transactions={filteredTransactions}
              onTransactionClick={handleTransactionClick}
              isSearching={isPending}
            />
          </div>
        )}

        {/* Bottom Sentinel for scrolling down */}
        <div ref={bottomSentinelRef} className="h-20 w-full flex justify-center items-center">
          {loadingMore && <FiLoader className="animate-spin text-[var(--color-muted)]" />}
        </div>
      </div>

      {/* Filters Drawer */}
      <Drawer
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        title="Filters"
        size="md"
      >
        <FiltersContent
          transactionType={transactionType}
          setTransactionType={setTransactionType}
          transactionStatus={transactionStatus}
          setTransactionStatus={setTransactionStatus}
          amountRange={amountRange}
          setAmountRange={setAmountRange}
          dateRange={dateRange}
          setDateRange={setDateRange}
          customDateRange={customDateRange}
          setCustomDateRange={setCustomDateRange}
          selectedGroupIds={selectedGroupIds}
          selectedCategoryIds={selectedCategoryIds}
          toggleGroup={toggleGroup}
          toggleCategory={toggleCategory}
          toggleGroupExpand={toggleGroupExpand}
          expandedGroups={expandedGroups}
          categoryGroups={categoryGroups}
          loadingCategoryGroups={loadingCategoryGroups}
          categoryGroupsError={categoryGroupsError}
          activeFilterCount={getActiveFilterCount()}
          onClearAll={handleClearAllFilters}
        />
      </Drawer>

      {/* Transaction Details Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        title="Transaction Details"
        size="md"
        views={[
          {
            id: 'transaction-details',
            title: '', // Empty title as requested
            showBackButton: transactionHistory.length > 0,
            content: <TransactionDetails
              transaction={selectedTransaction}
              onCategoryClick={handleCategoryClick}
              onSplitClick={handleSplitClick}
              onRepaymentClick={handleRepaymentClick}
              onDeleteSplit={handleDeleteSplit}
              onTransactionLinkClick={handleTransactionLinkClick}
            />
          },
          {
            id: 'select-category',
            title: 'Select Category',
            showBackButton: true,
            content: detectingSimilar ? (
              <div className="p-4 space-y-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-[var(--color-border)]/40 rounded" />
                  <div className="rounded-xl border border-[var(--color-border)]/40 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border-b border-[var(--color-border)]/20 last:border-0">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-border)]/40" />
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-3/4 bg-[var(--color-border)]/40 rounded" />
                            <div className="h-3 w-1/2 bg-[var(--color-border)]/40 rounded" />
                          </div>
                        </div>
                        <div className="h-4 w-16 bg-[var(--color-border)]/40 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-48 bg-[var(--color-border)]/40 rounded-xl" />
              </div>
            ) : (
              <SelectCategoryView
                categoryGroups={categoryGroups}
                onSelectCategory={handleCategorySelect}
                currentCategoryId={pendingCategory?.id || selectedTransaction?.category_id}
              />
            )
          },
          {
            id: 'similar-transactions',
            noPadding: true,
            title: (
              <div className="flex items-center gap-2 text-[var(--color-fg)]">
                <span>{similarTransactionsCount} Similar Transactions Found</span>
              </div>
            ),
            content: <SimilarTransactionsFound
              count={similarTransactionsCount}
              transactions={similarTransactions}
              criteria={matchCriteria}
              categoryName={pendingCategory?.label || selectedTransaction?.category_name}
              categoryGroups={categoryGroups}
              onEditCategory={handleEditCategory}
              onConfirm={handleConfirmRule}
              onClose={handleSimilarTransactionsClose}
              onCategorizeOnly={handleCategorizeOnly}
            />
          },
          {
            id: 'split-transaction',
            title: 'Split Transaction',
            showBackButton: true,
            content: <SplitTransactionView
              transaction={selectedTransaction}
              onSplitCreated={handleSplitCreated}
              onClose={handleBackToTransaction}
            />
          },
          {
            id: 'allocate-repayment',
            title: 'Allocate Repayment',
            showBackButton: true,
            content: <RepaymentView
              transaction={selectedTransaction}
              onRepaymentCreated={handleRepaymentCreated}
              onClose={handleBackToTransaction}
            />
          }
        ]}
        currentViewId={currentDrawerView}
        onViewChange={setCurrentDrawerView}
        onBack={handleBackToTransaction}
      />
    </PageContainer >
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionSkeleton />}>
      <TransactionsContent />
    </Suspense>
  );
}
