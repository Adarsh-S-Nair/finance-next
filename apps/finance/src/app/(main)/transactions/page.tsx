// @ts-nocheck — This file was converted from .jsx to .tsx alongside the
// infinite-scroll bugfix, but its many internal sub-components and
// event handlers were not fully typed. Proper typing (state generics,
// prop interfaces for the filter/picker components, DOM event targets)
// is tracked as a follow-up. Remove this pragma when doing that pass.
"use client";

import PageContainer from "../../../components/layout/PageContainer";
import SelectCategoryView from "../../../components/SelectCategoryView";
import { FiRefreshCw, FiFilter, FiSearch, FiLoader, FiX, FiChevronRight, FiChevronLeft } from "react-icons/fi";
import DynamicIcon from "../../../components/DynamicIcon";
import { LuReceipt } from "react-icons/lu";
import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, useTransition, memo, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { supabase } from "../../../lib/supabase/client";
import { authFetch } from "../../../lib/api/fetch";
import { PiBankFill } from "react-icons/pi";
import { formatAccountSubtype } from "../../../lib/accountSubtype";
import { formatCurrency as formatCurrencyBase } from "../../../lib/formatCurrency";
import { Button, Drawer } from "@zervo/ui";

import SearchInput from "../../../components/ui/SearchInput";
import TransactionDetails from "../../../components/transactions/TransactionDetails";
import SimilarTransactionsFound from "../../../components/transactions/SimilarTransactionsFound";
import TransactionRow from "../../../components/transactions/TransactionRow";
import SplitTransactionView from "../../../components/transactions/SplitTransactionView";
import RepaymentView from "../../../components/transactions/RepaymentView";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

const formatCurrency = (amount) => formatCurrencyBase(amount, true);

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

// SearchToolbar — portals into the topbar. On desktop it takes the
// title slot (search on the left, refresh/filter on the right). On
// mobile it renders an iOS-style collapsing search field that sits in
// place of the centered logo: a magnifier on the left by default,
// tapping it slides the search input out from the left edge while the
// logo fades out. The field stays open as long as the query has
// content (so it remains visible while scrolling search results) and
// collapses back to the logo view when the user blurs an empty field.
function SearchToolbar({ searchQuery, setSearchQuery, onRefresh, loading, onOpenFilters, activeFilterCount }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // `explicitlyOpen` — user tapped the magnifier; we keep the input
  // open until they blur with an empty query. When a query is present,
  // the input stays open regardless so the user can see what filter is
  // active as they scroll.
  const [explicitlyOpen, setExplicitlyOpen] = useState(() => searchQuery.length > 0);
  const searchOpen = explicitlyOpen || searchQuery.length > 0;
  const mobileInputRef = useRef(null);

  // Measure the mobile topbar row so we can animate the search pill's
  // width between the closed "just the magnifier" footprint (36px) and
  // the open "full row minus the filter button" footprint in actual
  // pixel values — the browser can't interpolate between 36px and a
  // percentage, but it can between two px numbers.
  const mobileRowRef = useRef(null);
  const FILTER_BTN_SIZE = 36;
  const FILTER_GAP = 4;
  const [pillOpenWidth, setPillOpenWidth] = useState(280);
  useLayoutEffect(() => {
    const el = mobileRowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const total = el.offsetWidth;
      setPillOpenWidth(Math.max(120, total - FILTER_BTN_SIZE - FILTER_GAP));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Focus the field when it first opens. Delayed a frame so the
  // slide-in animation has actually started before the keyboard
  // triggers — on iOS the keyboard pushing up can otherwise interrupt
  // the transition mid-way.
  useEffect(() => {
    if (!searchOpen) return;
    const raf = requestAnimationFrame(() => mobileInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [searchOpen]);

  const handleBlur = () => {
    if (!searchQuery.trim()) setExplicitlyOpen(false);
  };
  const handleClear = () => {
    setSearchQuery('');
    // Keep focus so the user can immediately start a new search.
    mobileInputRef.current?.focus();
  };

  const filterButton = (
    <button
      onClick={onOpenFilters}
      aria-label="Filter"
      className="relative w-9 h-9 flex items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors flex-shrink-0"
    >
      <FiFilter className="h-4 w-4" />
      {activeFilterCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
          {activeFilterCount}
        </span>
      )}
    </button>
  );

  const refreshButton = (
    <button
      onClick={onRefresh}
      disabled={loading}
      aria-label="Refresh"
      className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors disabled:opacity-50 flex-shrink-0"
    >
      <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );

  // Desktop topbar content — search on left, tools right-aligned
  const desktopContent = (
    <div className="flex items-center w-full">
      <SearchInput
        size="sm"
        wrapperClassName="max-w-sm w-full"
        placeholder="Search transactions"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="ml-auto flex items-center gap-1">
        {refreshButton}
        {filterButton}
      </div>
    </div>
  );

  const mobileContent = (
    <div ref={mobileRowRef} className="flex items-center w-full h-full relative">
      {/* Search pill. When closed, it's just the magnifier footprint
          (36px square). When open, it grows to the full row width
          minus the filter button. The magnifier doesn't disappear —
          it becomes the leading icon of the input. */}
      <motion.div
        animate={{ width: searchOpen ? pillOpenWidth : FILTER_BTN_SIZE }}
        transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
        className="h-9 rounded-md overflow-hidden relative flex-shrink-0 transition-colors duration-150"
        style={{
          backgroundColor: searchOpen
            ? 'var(--color-surface-alt)'
            : 'transparent',
        }}
      >
        {/* Magnifier — always at the left edge. Doubles as the
            "open the search" button when the pill is collapsed; once
            open it's just a static leading icon on the input. */}
        <button
          type="button"
          onClick={() => { if (!searchOpen) setExplicitlyOpen(true); }}
          aria-label={searchOpen ? 'Search' : 'Open search'}
          tabIndex={searchOpen ? -1 : 0}
          className="absolute left-0 top-0 h-9 w-9 flex items-center justify-center text-[var(--color-muted)] flex-shrink-0"
        >
          <FiSearch className={searchOpen ? 'h-4 w-4' : 'h-5 w-5'} />
        </button>

        {/* Input — transparent background on top of the pill's own
            surface-alt fill. Fades in when opened so the text doesn't
            flash on the closed 36px footprint. */}
        <input
          ref={mobileInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={handleBlur}
          placeholder="Search transactions"
          aria-hidden={!searchOpen}
          className="absolute left-0 top-0 w-full h-9 pl-9 pr-9 text-sm bg-transparent border-0 text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none"
          style={{
            opacity: searchOpen ? 1 : 0,
            pointerEvents: searchOpen ? 'auto' : 'none',
            transition: 'opacity 0.18s ease-out',
            transitionDelay: searchOpen ? '0.08s' : '0s',
          }}
        />

        {/* Clear button — inside the pill, only when there's text. */}
        <AnimatePresence>
          {searchQuery && searchOpen && (
            <motion.button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)]"
            >
              <FiX className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filter button — always at the right edge. */}
      <div className="ml-auto relative z-10 flex-shrink-0">
        {filterButton}
      </div>
    </div>
  );

  const desktopPortal = mounted ? document.getElementById("page-title-portal") : null;
  const mobilePortal = mounted ? document.getElementById("page-mobile-topbar-portal") : null;

  return (
    <>
      {desktopPortal && createPortal(desktopContent, desktopPortal)}
      {mobilePortal && createPortal(mobileContent, mobilePortal)}
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
    <div className="space-y-6 pb-24">
      {sortedDates.map((dateKey, groupIndex) => (
        <div key={dateKey} className="relative">
          <div className="sticky top-16 z-20 py-2 bg-[var(--color-content-bg)]">
            <span className="text-sm font-medium text-[var(--color-muted)]">
              {formatDateHeader(dateKey === 'Unknown' ? null : dateKey)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {grouped[dateKey].map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
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



// ─── Filter primitives ──────────────────────────────────────────────

// Drilldown row used in the main filter list
const FilterRow = ({ label, value, onClick, isActive }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-[var(--color-surface-alt)]/60 transition-colors"
  >
    <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
    <div className="flex items-center gap-2 min-w-0">
      <span className={`text-sm truncate ${isActive ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>
        {value}
      </span>
      <span className="text-[var(--color-muted)] text-base leading-none">&#8250;</span>
    </div>
  </button>
);

// Single-select option row (radio behaviour, with checkmark)
const OptionRow = ({ label, dotColor, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-[var(--color-surface-alt)]/60 transition-colors"
  >
    <div className="flex items-center gap-3 min-w-0">
      {dotColor && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}
      <span className="text-sm text-[var(--color-fg)] truncate">{label}</span>
    </div>
    {selected && (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-fg)] flex-shrink-0">
        <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

// ─── Filter list view (main) ────────────────────────────────────────

const FilterListView = ({
  summaries, activeFilterCount, onClearAll, onSelectFilter
}) => (
  <div>
    {activeFilterCount > 0 && onClearAll && (
      <div className="flex items-center justify-between px-5 py-3 mb-1 border-b border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-muted)]">
          {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
        </span>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-[var(--color-fg)] hover:opacity-70 transition-opacity"
        >
          Reset all
        </button>
      </div>
    )}

    <FilterRow label="Type" value={summaries.type.label} isActive={summaries.type.active} onClick={() => onSelectFilter('type')} />
    <FilterRow label="Status" value={summaries.status.label} isActive={summaries.status.active} onClick={() => onSelectFilter('status')} />
    <FilterRow label="Amount" value={summaries.amount.label} isActive={summaries.amount.active} onClick={() => onSelectFilter('amount')} />
    <FilterRow label="Date" value={summaries.date.label} isActive={summaries.date.active} onClick={() => onSelectFilter('date')} />
    <FilterRow label="Categories" value={summaries.categories.label} isActive={summaries.categories.active} onClick={() => onSelectFilter('categories')} />
    <FilterRow label="Account" value={summaries.account.label} isActive={summaries.account.active} onClick={() => onSelectFilter('account')} />
  </div>
);

// ─── Single-select picker (Type, Status) ────────────────────────────

const SingleSelectView = ({ options, value, onChange }) => (
  <div>
    {options.map((option) => (
      <OptionRow
        key={option.value}
        label={option.label}
        selected={value === option.value}
        onClick={() => onChange(option.value)}
      />
    ))}
  </div>
);

// ─── Amount picker ──────────────────────────────────────────────────

const AmountPickerView = ({ amountRange, setAmountRange }) => (
  <div className="pt-1 pb-2 space-y-4">
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Minimum</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amountRange.min}
          onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
          className="w-full pl-7 pr-3 py-3 text-sm bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
        />
      </div>
    </div>
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">Maximum</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Any"
          value={amountRange.max}
          onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
          className="w-full pl-7 pr-3 py-3 text-sm bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
        />
      </div>
    </div>
  </div>
);

// ─── Date picker ────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30days', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

const DatePickerView = ({ dateRange, setDateRange, customDateRange, setCustomDateRange }) => (
  <div>
    {DATE_OPTIONS.map((option) => (
      <OptionRow
        key={option.value}
        label={option.label}
        selected={dateRange === option.value}
        onClick={() => setDateRange(option.value)}
      />
    ))}
    {dateRange === 'custom' && (
      <div className="px-5 pt-4 pb-2 space-y-4 border-t border-[var(--color-border)]">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">From</label>
          <input
            type="date"
            value={customDateRange.start}
            onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
            className="w-full px-3 py-3 text-sm bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2">To</label>
          <input
            type="date"
            value={customDateRange.end}
            onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
            className="w-full px-3 py-3 text-sm bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20"
          />
        </div>
      </div>
    )}
  </div>
);

// ─── Category picker ────────────────────────────────────────────────

// Icon badge matching the look used in TransactionRow — group's hex color
// filled circle with a white DynamicIcon centered. Kept here so the
// filter picker and the categorize-a-transaction picker render groups
// identically.
const CategoryIconBadge = ({ hexColor, iconLib, iconName, size = "md" }) => {
  const dim = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${dim}`}
      style={{ backgroundColor: hexColor || 'var(--color-accent)' }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className={`${iconDim} text-white`}
        style={{ strokeWidth: 2.25 }}
      />
    </div>
  );
};

const CategoryPickerView = ({
  categoryGroups, loadingCategoryGroups, categoryGroupsError,
  selectedGroupIds, selectedCategoryIds,
  toggleGroup, toggleCategory,
}) => {
  const [search, setSearch] = useState("");
  const [drilledGroupId, setDrilledGroupId] = useState(null);

  const isSearching = search.trim().length > 0;

  // Searching exits the drilled view so the user can scan the full
  // flat result set without confusion. Mirrors SelectCategoryView.
  useEffect(() => {
    if (isSearching && drilledGroupId) setDrilledGroupId(null);
  }, [isSearching, drilledGroupId]);

  // Per-group selection count. A group-level selection in
  // selectedGroupIds means "every category in this group" — we surface
  // that as "All N selected" in the subtitle.
  const computeGroupSelection = (group) => {
    const total = (group.system_categories || []).length;
    if (selectedGroupIds.includes(group.id)) {
      return { selected: total, total, all: true };
    }
    const selected = (group.system_categories || []).filter((c) =>
      selectedCategoryIds.includes(c.id)
    ).length;
    return { selected, total, all: false };
  };

  // Flat search results across every group's children.
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase();
    const results = [];
    for (const group of categoryGroups) {
      const groupMatches = group.name.toLowerCase().includes(q);
      for (const cat of group.system_categories || []) {
        if (groupMatches || cat.label.toLowerCase().includes(q)) {
          results.push({ category: cat, group });
        }
      }
    }
    return results;
  }, [categoryGroups, isSearching, search]);

  const drilledGroup = useMemo(
    () => categoryGroups.find((g) => g.id === drilledGroupId) ?? null,
    [categoryGroups, drilledGroupId]
  );

  // Click a single category inside a drilled group. If the parent group
  // is currently selected as a whole (legacy bucket-select), expand it
  // into individual selections minus the one the user is toggling off.
  const handleCategoryClick = (group, category) => {
    const isGroupSelected = selectedGroupIds.includes(group.id);
    if (isGroupSelected) {
      toggleGroup(group.id);
      group.system_categories?.forEach((c) => {
        if (c.id !== category.id && !selectedCategoryIds.includes(c.id)) toggleCategory(c.id);
      });
    } else {
      toggleCategory(category.id);
    }
  };

  // "Select all in group" toggle inside the drilled view. Two behaviors:
  // - currently all selected (either via group-level or every-category-
  //   individually): clear everything for this group
  // - otherwise: select via the compact group-level bucket and drop any
  //   individual selections that overlap
  const handleToggleAllInGroup = (group) => {
    const { all, selected, total } = computeGroupSelection(group);
    const everyOneIndividually = !all && selected === total && total > 0;

    if (all) {
      toggleGroup(group.id);
      return;
    }
    if (everyOneIndividually) {
      (group.system_categories || []).forEach((c) => toggleCategory(c.id));
      return;
    }
    // Drop individual selections first, then promote to a group-level
    // selection so the URL state stays compact.
    (group.system_categories || []).forEach((c) => {
      if (selectedCategoryIds.includes(c.id)) toggleCategory(c.id);
    });
    toggleGroup(group.id);
  };

  if (loadingCategoryGroups) {
    return (
      <div>
        <div className="pb-1">
          <SearchInput placeholder="Search categories" value={search} onChange={(e) => setSearch(e.target.value)} disabled />
        </div>
        <div className="space-y-2 py-2">
          {[...Array(8)].map((_, idx) => (
            <div key={idx} className="h-12 bg-[var(--color-surface-alt)] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (categoryGroupsError) {
    return <div className="py-3 text-sm text-[var(--color-muted)]">{categoryGroupsError}</div>;
  }

  return (
    <div>
      <div className="pb-3">
        <SearchInput
          placeholder="Search categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isSearching ? (
        searchResults.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-muted)]">No categories found</div>
        ) : (
          <div>
            {searchResults.map(({ category, group }) => {
              const isGroupSelected = selectedGroupIds.includes(group.id);
              const selected = isGroupSelected || selectedCategoryIds.includes(category.id);
              return (
                <button
                  key={`${group.id}:${category.id}`}
                  type="button"
                  onClick={() => handleCategoryClick(group, category)}
                  className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors text-left"
                >
                  <CategoryIconBadge
                    hexColor={group.hex_color}
                    iconLib={group.icon_lib}
                    iconName={group.icon_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--color-fg)] truncate">{category.label}</div>
                    <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">{group.name}</div>
                  </div>
                  {selected && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-fg)] flex-shrink-0">
                      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )
      ) : drilledGroup ? (
        (() => {
          const { selected, total, all } = computeGroupSelection(drilledGroup);
          const everyOneIndividually = !all && selected === total && total > 0;
          const allSelected = all || everyOneIndividually;
          return (
            <div>
              <button
                type="button"
                onClick={() => setDrilledGroupId(null)}
                className="flex items-center gap-1.5 mb-3 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                <FiChevronLeft className="w-3.5 h-3.5" />
                All groups
              </button>
              <div className="flex items-center gap-2.5 mb-3">
                <CategoryIconBadge
                  hexColor={drilledGroup.hex_color}
                  iconLib={drilledGroup.icon_lib}
                  iconName={drilledGroup.icon_name}
                  size="sm"
                />
                <span className="text-sm font-medium text-[var(--color-fg)] flex-1 truncate">
                  {drilledGroup.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleAllInGroup(drilledGroup)}
                  className="text-[11px] font-medium text-[var(--color-fg)] hover:opacity-70 transition-opacity"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div>
                {(drilledGroup.system_categories || []).map((category) => {
                  const isSelected = all || selectedCategoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategoryClick(drilledGroup, category)}
                      className="flex items-center justify-between w-full py-2.5 px-1 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.hex_color || drilledGroup.hex_color || 'var(--color-muted)' }}
                        />
                        <span className="text-sm text-[var(--color-fg)] truncate">{category.label}</span>
                      </div>
                      {isSelected && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-fg)] flex-shrink-0">
                          <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : (
        <div>
          {categoryGroups.map((group) => {
            const { selected, total, all } = computeGroupSelection(group);
            const subtitle =
              all || (selected === total && total > 0)
                ? `All ${total} selected`
                : selected > 0
                  ? `${selected} of ${total} selected`
                  : `${total} categories`;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setDrilledGroupId(group.id)}
                className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors text-left"
              >
                <CategoryIconBadge
                  hexColor={group.hex_color}
                  iconLib={group.icon_lib}
                  iconName={group.icon_name}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--color-fg)] truncate">{group.name}</div>
                  <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
                    {subtitle}
                  </div>
                </div>
                <FiChevronRight className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Account picker ─────────────────────────────────────────────────
const AccountPickerView = ({ accounts, institutionMap, value, onChange }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const institution = institutionMap[a.institutionId];
      const haystack = [
        a.name,
        a.type,
        a.mask,
        institution?.name,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, institutionMap, search]);

  return (
    <div>
      {accounts.length > 6 && (
        <div className="pb-1">
          <SearchInput
            placeholder="Search accounts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className={accounts.length > 6 ? "-mx-5" : ""}>
        <OptionRow
          label="All accounts"
          selected={value === 'all'}
          onClick={() => onChange('all')}
        />
        {filtered.map((account) => {
          const institution = institutionMap[account.institutionId];
          const selected = value === account.id;
          const subtype = formatAccountSubtype(account.type);
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onChange(account.id)}
              className="flex items-center justify-between w-full px-5 py-3 text-left hover:bg-[var(--color-surface-alt)]/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
                  {institution?.logo ? (
                    <img
                      src={institution.logo}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full items-center justify-center ${institution?.logo ? 'hidden' : 'flex'}`}>
                    <PiBankFill className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-[var(--color-fg)] truncate">{account.name}</span>
                  <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                    {subtype && <span className="truncate">{subtype}</span>}
                    {subtype && account.mask && <span className="opacity-40">·</span>}
                    {account.mask && <span className="font-mono">•••• {account.mask}</span>}
                  </div>
                </div>
              </div>
              {selected && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-fg)] flex-shrink-0 ml-3">
                  <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-[var(--color-muted)]">No accounts found</div>
        )}
      </div>
    </div>
  );
};

function TransactionsContent() {
  const { user, profile } = useUser();
  const { allAccounts, accounts: institutions } = useAccounts();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();

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
  const [filterDrawerView, setFilterDrawerView] = useState('list');
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
  const [selectedAccountId, setSelectedAccountId] = useState(() =>
    searchParams.get('accountId') || 'all'
  );

  const institutionMapForFilter = useMemo(() => {
    const map = {};
    (institutions || []).forEach((inst) => { map[inst.id] = inst; });
    return map;
  }, [institutions]);

  // Sync URL → state when the URL changes while the user is already
  // on /transactions. Without this, clicking a link that deep-links
  // into the transactions page (e.g. the "Unmatched transfers"
  // insight or a slice of the top-spending donut) just updates the
  // query string but leaves the filter state untouched, so the list
  // doesn't actually narrow. Only react to *incoming* URL changes —
  // the state → URL effect below handles the other direction.
  const statusParam = searchParams.get('status') || 'all';
  const dateRangeParam = (() => {
    const raw = searchParams.get('dateRange');
    if (raw) return raw;
    if (searchParams.get('startDate') || searchParams.get('endDate')) return 'custom';
    return 'all';
  })();
  const categoryIdsParam = searchParams.get('categoryIds') || '';
  const groupIdsParam = searchParams.get('groupIds') || '';

  useEffect(() => {
    if (statusParam !== transactionStatus) setTransactionStatus(statusParam);
    if (dateRangeParam !== dateRange) setDateRange(dateRangeParam);
    const nextCategoryIds = categoryIdsParam ? categoryIdsParam.split(',').filter(Boolean) : [];
    if (nextCategoryIds.join(',') !== selectedCategoryIds.join(',')) {
      setSelectedCategoryIds(nextCategoryIds);
    }
    const nextGroupIds = groupIdsParam ? groupIdsParam.split(',').filter(Boolean) : [];
    if (nextGroupIds.join(',') !== selectedGroupIds.join(',')) {
      setSelectedGroupIds(nextGroupIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusParam, dateRangeParam, categoryIdsParam, groupIdsParam]);

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
    if (selectedAccountId !== 'all') params.set('accountId', selectedAccountId);

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
    selectedAccountId,
    pathname,
    router,
    searchParams
  ]);

  const [nextCursor, setNextCursor] = useState(null);
  const [prevCursor, setPrevCursor] = useState(null);

  // Cache the most recent successful fetch in react-query, keyed by
  // the active filter combo. On remount (e.g. navigating away from
  // /transactions and back) we hydrate from this stash before kicking
  // off any network request, so the user sees the previous page of
  // rows instantly instead of a skeleton flash. Background refetch
  // still runs to pick up new transactions.
  const transactionsCacheKey = useMemo(
    () => [
      'transactions:list',
      user?.id,
      debouncedSearchQuery,
      transactionType,
      transactionStatus,
      amountRange.min,
      amountRange.max,
      dateRange,
      customDateRange.start,
      customDateRange.end,
      selectedGroupIds.join(','),
      selectedCategoryIds.join(','),
      selectedAccountId,
    ],
    [
      user?.id,
      debouncedSearchQuery,
      transactionType,
      transactionStatus,
      amountRange.min,
      amountRange.max,
      dateRange,
      customDateRange.start,
      customDateRange.end,
      selectedGroupIds,
      selectedCategoryIds,
      selectedAccountId,
    ],
  );

  const PAGE_LIMIT = 20;
  // Windowing threshold — DOM stays capped at this count. Higher means
  // fewer trim operations (each trim can cause a visible jump on mobile
  // momentum scroll), but more memory for users who scroll far back.
  const MAX_ITEMS = 200;
  const initialAbortRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);
  const containerRef = useRef(null);
  // We rely on the browser's native scroll anchoring (overflow-anchor:
  // auto, default) to preserve the user's visual position when items
  // are added/removed above the viewport. A manual scrollBy in a
  // useLayoutEffect fought with iOS momentum scroll and caused a
  // visible snap/flash, so it was removed.

  // Fetch transactions helper
  const fetchTransactionsData = useCallback(async (cursor = null, direction = 'forward') => {
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

    if (selectedAccountId && selectedAccountId !== 'all') {
      params.append('accountId', selectedAccountId);
    }

    // Date filtering
    //
    // The API expects YYYY-MM-DD and filters against a DATE column.
    // We MUST send the user's local-calendar date, not a UTC one. The
    // earlier version `new Date(string).toISOString()` round-tripped the
    // input through UTC midnight and shifted it back by one day for any
    // user east of UTC — picking "Apr 1" sent "2026-03-31" to the API,
    // which then included Mar 31 transactions in the result. Format
    // local Date objects via getFullYear/getMonth/getDate, and pass
    // <input type="date"> values through verbatim (they're already
    // YYYY-MM-DD with no timezone).
    if (dateRange !== 'all') {
      const formatLocalDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      let startStr, endStr;

      if (dateRange === 'today') {
        const now = new Date();
        startStr = formatLocalDate(now);
        endStr = formatLocalDate(now);
      } else if (dateRange === 'week') {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        startStr = formatLocalDate(start);
        endStr = formatLocalDate(now);
      } else if (dateRange === 'month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startStr = formatLocalDate(start);
        endStr = formatLocalDate(end);
      } else if (dateRange === '30days') {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        startStr = formatLocalDate(start);
        endStr = formatLocalDate(now);
      } else if (dateRange === 'custom') {
        // <input type="date"> values are already YYYY-MM-DD with no
        // timezone — pass through, never round-trip through Date.
        if (customDateRange.start) startStr = customDateRange.start;
        if (customDateRange.end) endStr = customDateRange.end;
      }

      if (startStr) params.append('startDate', startStr);
      if (endStr) params.append('endDate', endStr);
    }

    const response = await authFetch(`/api/plaid/transactions/get?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return await response.json();
  }, [
    user?.id,
    debouncedSearchQuery,
    transactionType,
    transactionStatus,
    amountRange.min,
    amountRange.max,
    dateRange,
    customDateRange.start,
    customDateRange.end,
    selectedGroupIds,
    selectedCategoryIds,
    selectedAccountId,
  ]);

  // Initial fetch — also stashes the result in the react-query
  // cache so the next time this filter combo mounts we can paint
  // immediately without a skeleton flash.
  const fetchInitialTransactions = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      if (initialAbortRef.current) initialAbortRef.current.abort();

      const data = await fetchTransactionsData();
      const txs = data.transactions || [];
      setTransactions(txs);
      setNextCursor(data.nextCursor);
      // Initial fetch starts at the newest transaction, so there's
      // nothing newer to load. Leaving prevCursor null prevents the
      // top sentinel + observer from immediately firing a no-op
      // loadPrev that flashes a spinner and shifts the list. The
      // windowing path inside loadMore will populate prevCursor
      // properly once we trim from the top.
      setPrevCursor(null);
      queryClient.setQueryData(transactionsCacheKey, {
        transactions: txs,
        nextCursor: data.nextCursor,
        prevCursor: null,
      });
      return data.transactions;
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchTransactionsData, queryClient, transactionsCacheKey]);

  // Hydrate from cache before the initial fetch runs. Suppresses the
  // skeleton when we already know what to show; background refetch
  // still happens via the existing fetchInitialTransactions effect.
  const cacheKeyFingerprint = transactionsCacheKey.join('|');
  useLayoutEffect(() => {
    const cached = queryClient.getQueryData(transactionsCacheKey);
    if (cached && Array.isArray(cached.transactions)) {
      setTransactions(cached.transactions);
      setNextCursor(cached.nextCursor ?? null);
      setPrevCursor(cached.prevCursor ?? null);
      // Render the cached data instantly. The fetchInitialTransactions
      // effect below will still run and refresh in the background.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKeyFingerprint]);

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
  }, [loadingMore, nextCursor, fetchTransactionsData]);

  // Load previous (prev page - newer transactions)
  const loadPrev = useCallback(async () => {
    if (loadingPrev || !prevCursor) return;

    try {
      setLoadingPrev(true);
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
      }
    } catch (err) {
      console.error('Error loading prev:', err);
    } finally {
      setLoadingPrev(false);
    }
  }, [loadingPrev, prevCursor, fetchTransactionsData]);

  // Intersection Observer for infinite scroll. Use refs for the
  // callbacks so the observer is created once and never re-attaches —
  // re-attaching causes an immediate intersection fire if the sentinel
  // is already in view, which compounded the runaway-loading bug.
  const loadMoreRef = useRef(loadMore);
  const loadPrevRef = useRef(loadPrev);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);
  useEffect(() => { loadPrevRef.current = loadPrev; }, [loadPrev]);

  // Recreate the observer whenever a cursor changes. IntersectionObserver
  // only emits on *transitions*, so if we attached once on mount (when
  // nextCursor was still null) the observer would fire a no-op load and
  // then stay quiet forever — the list would be stuck at 20 rows. By
  // re-attaching on cursor changes, each new cursor gets a fresh initial
  // intersection report, which covers both the initial-load case and
  // short lists that don't overflow the viewport. The runaway-loading
  // loop that motivated the mount-once approach is prevented separately
  // by the scroll anchor, which preserves the user's visual position
  // during windowing trim so the sentinel ends up below the rootMargin
  // after each successful fetch.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target === bottomSentinelRef.current) {
            loadMoreRef.current?.();
          } else if (entry.target === topSentinelRef.current) {
            loadPrevRef.current?.();
          }
        });
      },
      { rootMargin: '200px' }
    );

    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);
    if (topSentinelRef.current) observer.observe(topSentinelRef.current);

    return () => observer.disconnect();
  }, [nextCursor, prevCursor]);

  useEffect(() => {
    fetchInitialTransactions();
    const initialAbort = initialAbortRef.current;
    return () => {
      if (initialAbort) initialAbort.abort();
    };
  }, [fetchInitialTransactions]); // Re-fetch when ANY filter changes

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
          .select('id, name, icon_lib, icon_name, hex_color, system_categories(id, label, hex_color, direction)')
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
    if (selectedAccountId !== 'all') count++;
    return count;
  };

  // Display summaries shown next to each filter row in the list view
  const filterSummaries = useMemo(() => {
    const dateLabel = (DATE_OPTIONS.find(o => o.value === dateRange) || {}).label || 'All time';

    let amountLabel = 'Any';
    if (amountRange.min || amountRange.max) {
      const min = amountRange.min ? `$${amountRange.min}` : '';
      const max = amountRange.max ? `$${amountRange.max}` : '';
      if (min && max) amountLabel = `${min} – ${max}`;
      else if (min) amountLabel = `${min}+`;
      else amountLabel = `Up to ${max}`;
    }

    const totalCategorySelections = selectedGroupIds.length + selectedCategoryIds.length;
    let categoryLabel = 'All';
    if (totalCategorySelections === 1) {
      const cat = categoryGroups
        .flatMap(g => g.system_categories || [])
        .find(c => selectedCategoryIds.includes(c.id));
      const grp = categoryGroups.find(g => selectedGroupIds.includes(g.id));
      categoryLabel = cat?.label || grp?.name || '1 selected';
    } else if (totalCategorySelections > 1) {
      categoryLabel = `${totalCategorySelections} selected`;
    }

    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    let accountLabel = 'All';
    if (selectedAccountId !== 'all') {
      const match = (allAccounts || []).find(a => a.id === selectedAccountId);
      accountLabel = match?.name || '1 selected';
    }

    return {
      type: { label: transactionType === 'all' ? 'All' : cap(transactionType), active: transactionType !== 'all' },
      status: { label: transactionStatus === 'all' ? 'All' : (transactionStatus === 'attention' ? 'Needs attention' : cap(transactionStatus)), active: transactionStatus !== 'all' },
      amount: { label: amountLabel, active: amountLabel !== 'Any' },
      date: { label: dateLabel, active: dateRange !== 'all' },
      categories: { label: categoryLabel, active: totalCategorySelections > 0 },
      account: { label: accountLabel, active: selectedAccountId !== 'all' },
    };
  }, [transactionType, transactionStatus, amountRange, dateRange, selectedGroupIds, selectedCategoryIds, categoryGroups, selectedAccountId, allAccounts]);

  // Reset to list view when the filters drawer closes
  const closeFiltersDrawer = useCallback(() => {
    setIsFiltersOpen(false);
    setFilterDrawerView('list');
  }, []);

  // Type/Status options (used by the picker views)
  const typeOptions = [
    { value: 'all', label: 'All' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
  ];
  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'attention', label: 'Needs attention' },
  ];

  const buildFilterDrawerViews = () => [
    {
      id: 'list',
      title: 'Filters',
      noPadding: true,
      content: (
        <FilterListView
          summaries={filterSummaries}
          activeFilterCount={getActiveFilterCount()}
          onClearAll={handleClearAllFilters}
          onSelectFilter={(id) => setFilterDrawerView(id)}
        />
      ),
    },
    {
      id: 'type',
      title: 'Type',
      showBackButton: true,
      noPadding: true,
      content: (
        <SingleSelectView
          options={typeOptions}
          value={transactionType}
          onChange={setTransactionType}
        />
      ),
    },
    {
      id: 'status',
      title: 'Status',
      showBackButton: true,
      noPadding: true,
      content: (
        <SingleSelectView
          options={statusOptions}
          value={transactionStatus}
          onChange={setTransactionStatus}
        />
      ),
    },
    {
      id: 'amount',
      title: 'Amount',
      showBackButton: true,
      content: (
        <AmountPickerView
          amountRange={amountRange}
          setAmountRange={setAmountRange}
        />
      ),
    },
    {
      id: 'date',
      title: 'Date',
      showBackButton: true,
      noPadding: true,
      content: (
        <DatePickerView
          dateRange={dateRange}
          setDateRange={setDateRange}
          customDateRange={customDateRange}
          setCustomDateRange={setCustomDateRange}
        />
      ),
    },
    {
      id: 'categories',
      title: 'Categories',
      showBackButton: true,
      content: (
        <CategoryPickerView
          categoryGroups={categoryGroups}
          loadingCategoryGroups={loadingCategoryGroups}
          categoryGroupsError={categoryGroupsError}
          selectedGroupIds={selectedGroupIds}
          selectedCategoryIds={selectedCategoryIds}
          toggleGroup={toggleGroup}
          toggleCategory={toggleCategory}
        />
      ),
    },
    {
      id: 'account',
      title: 'Account',
      showBackButton: true,
      noPadding: true,
      content: (
        <AccountPickerView
          accounts={allAccounts || []}
          institutionMap={institutionMapForFilter}
          value={selectedAccountId}
          onChange={setSelectedAccountId}
        />
      ),
    },
  ];

  // Clear all filters
  const handleClearAllFilters = () => {
    setSelectedGroupIds([]);
    setSelectedCategoryIds([]);
    setAmountRange({ min: '', max: '' });
    setDateRange('all');
    setCustomDateRange({ start: '', end: '' });
    setTransactionType('all');
    setTransactionStatus('all');
    setSelectedAccountId('all');
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

  // Returns true when the transaction still matches the active filter.
  // Used to drop rows from the list optimistically after a category
  // change or mark-as-reviewed so the user doesn't see stale
  // "needs-attention" rows sitting around until the next fetch.
  const matchesCurrentFilters = useCallback(
    (tx) => {
      if (transactionStatus === 'attention') {
        if (tx.is_unmatched_transfer) return true;
        if (tx.is_unmatched_payment) return true;
        if (tx.account_name === 'Unknown Account') return true;
        return false;
      }
      if (transactionStatus === 'pending') return !!tx.pending;
      if (transactionStatus === 'completed') return !tx.pending;
      return true;
    },
    [transactionStatus],
  );

  // Apply a per-row optimistic update to whichever local collections
  // hold that transaction (the main list + the currently-selected
  // detail row). If the updated tx no longer matches the active
  // filter, drop it from the list instead of stranding a stale row.
  const applyTransactionUpdate = useCallback(
    (id, patch) => {
      setTransactions((prev) =>
        prev
          .map((t) => (t.id === id ? { ...t, ...patch } : t))
          .filter((t) => (t.id === id ? matchesCurrentFilters(t) : true)),
      );
      setSelectedTransaction((prev) =>
        prev && prev.id === id ? { ...prev, ...patch } : prev,
      );
    },
    [matchesCurrentFilters],
  );

  const updateTransactionCategory = async (category) => {
    // Find the group for this category to get the color/icon
    const group = categoryGroups.find(g => g.system_categories.some(c => c.id === category.id));

    // Optimistic update. Also clear is_unmatched_transfer here so the
    // warning icon disappears immediately — the DB update below is the
    // source of truth but the UI shouldn't wait on it.
    applyTransactionUpdate(selectedTransaction.id, {
      category_id: category.id,
      category_name: category.label,
      category_hex_color: group?.hex_color,
      category_icon_lib: group?.icon_lib,
      category_icon_name: group?.icon_name,
      is_unmatched_transfer: false,
      is_unmatched_payment: false,
    });
    setCurrentDrawerView('transaction-details');
    setPendingCategory(null); // Clear pending

    try {
      // - is_user_categorized flags the row so the Plaid sync preserves
      //   this choice — otherwise the next DEFAULT_UPDATE webhook would
      //   reset the category back to the PFC Plaid returns.
      // - is_unmatched_transfer is cleared because the transfer-detection
      //   pass only *sets* the flag on rows it classifies as transfers;
      //   moving a row out of a transfer category leaves the flag stale
      //   and the alert icon sticks around. Clearing it here is always
      //   safe — if the user later picks a transfer category, the next
      //   detection run will recompute.
      const { error } = await supabase
        .from('transactions')
        .update({
          category_id: category.id,
          is_user_categorized: true,
          is_unmatched_transfer: false,
        })
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

          // Optimistic update for similar transactions in the list.
          // Rows that no longer match the active filter (e.g. the
          // "attention" filter) get dropped automatically.
          const patch = {
            category_id: pendingCategory.id,
            category_name: pendingCategory.label,
            category_hex_color: group?.hex_color,
            category_icon_lib: group?.icon_lib,
            category_icon_name: group?.icon_name,
            is_unmatched_transfer: false,
            is_unmatched_payment: false,
          };
          const selectedSet = new Set(selectedIds);
          setTransactions((prev) =>
            prev
              .map((t) => (selectedSet.has(t.id) ? { ...t, ...patch } : t))
              .filter((t) => (selectedSet.has(t.id) ? matchesCurrentFilters(t) : true)),
          );

          // Same rationale as the single-transaction update: pin these
          // rows so future syncs preserve the choice, and clear the
          // unmatched-transfer flag in case any of them were stale
          // transfers that the user is re-classifying.
          const { error } = await supabase
            .from('transactions')
            .update({
              category_id: pendingCategory.id,
              is_user_categorized: true,
              is_unmatched_transfer: false,
            })
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

  const selectedTransactionId = selectedTransaction?.id;

  // User chose "Mark as reviewed" — dismiss the needs-attention flag
  // without changing the category. Same optimistic+supabase-update
  // path as a category change, minus the category bits.
  const handleMarkReviewed = useCallback(async () => {
    if (!selectedTransactionId) return;
    applyTransactionUpdate(selectedTransactionId, {
      is_unmatched_transfer: false,
      is_unmatched_payment: false,
    });
    // Close the drawer if the row was dropped from the filtered list,
    // since its "selected" state no longer points at anything visible.
    if (transactionStatus === 'attention') {
      setIsDrawerOpen(false);
    }
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_unmatched_transfer: false })
        .eq('id', selectedTransactionId);
      if (error) throw error;
    } catch (err) {
      console.error('Error marking transaction as reviewed:', err);
    }
  }, [selectedTransactionId, applyTransactionUpdate, transactionStatus]);

  // Use transactions directly since they are now server-filtered
  const filteredTransactions = transactions;

  // Show loading state with smooth transition
  const isSearchLoading = isPending || loading;

  // Only show the full-page skeleton when we genuinely have nothing
  // to render yet. Cache hydration above populates `transactions`
  // synchronously on remount, which means the skeleton is skipped
  // entirely on every revisit within the gcTime window.
  const showInitialSkeleton =
    !user?.id || (loading && !debouncedSearchQuery && transactions.length === 0);

  if (showInitialSkeleton) {
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
          onClose={closeFiltersDrawer}
          title="Filters"
          size="md"
          views={buildFilterDrawerViews()}
          currentViewId={filterDrawerView}
          onViewChange={setFilterDrawerView}
          onBack={() => setFilterDrawerView('list')}
        />
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
      <div className="space-y-0 relative" ref={containerRef}>
        {/* Top sentinel — just a marker for the IntersectionObserver that
            triggers loadPrev. Zero height / absolutely positioned so it
            doesn't show up as an empty strip under the topbar. */}
        <div
          ref={topSentinelRef}
          aria-hidden
          className="absolute left-0 right-0 top-0 h-px pointer-events-none"
        />
        {loadingPrev && (
          <div className="flex justify-center py-2">
            <FiLoader className="animate-spin text-[var(--color-muted)] h-4 w-4" />
          </div>
        )}

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
        onClose={closeFiltersDrawer}
        title="Filters"
        size="md"
        views={buildFilterDrawerViews()}
        currentViewId={filterDrawerView}
        onViewChange={setFilterDrawerView}
        onBack={() => setFilterDrawerView('list')}
      />

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
              onMarkReviewed={handleMarkReviewed}
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
                transactionAmount={selectedTransaction?.amount ?? null}
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
