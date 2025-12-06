"use client";

import PageContainer from "../../../components/PageContainer";
import Button from "../../../components/ui/Button";
import DynamicIcon from "../../../components/DynamicIcon";
import Drawer from "../../../components/ui/Drawer";
import SelectCategoryView from "../../../components/SelectCategoryView";
import Card from "../../../components/ui/Card";
import { FiRefreshCw, FiFilter, FiSearch, FiTag, FiLoader, FiChevronDown, FiChevronUp, FiX, FiDollarSign, FiCalendar, FiTrendingUp, FiTrendingDown, FiClock, FiAlertCircle } from "react-icons/fi";
import { LuReceipt } from "react-icons/lu";
import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, useTransition, memo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../../../components/UserProvider";
import Input from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabaseClient";
import PageToolbar from "../../../components/PageToolbar";
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

// SearchToolbar component for consistent styling
function SearchToolbar({ searchQuery, setSearchQuery, onRefresh, loading, onOpenFilters, activeFilterCount }) {
  return (
    <PageToolbar>
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-4xl">
          <div className="relative rounded-xl border border-[color-mix(in_oklab,var(--color-fg),transparent_92%)] bg-[var(--color-surface)]/50 focus-within:bg-[var(--color-surface)] focus-within:border-[var(--color-accent)]/50 transition-all duration-200">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-transparent border-0 outline-none focus:outline-none ring-0 focus:ring-0 focus:border-0 focus-visible:outline-none shadow-none text-base"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            onClick={onRefresh}
            variant="ghost"
            size="icon"
            aria-label="Refresh Transactions"
            disabled={loading}
            className="hover:bg-[var(--color-surface)]"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Filter Transactions"
            onClick={onOpenFilters}
            className="hover:bg-[var(--color-surface)] relative"
          >
            <FiFilter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[var(--color-accent)] text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center animate-fade-in">
                {activeFilterCount}
              </span>
            )}
          </Button>

        </div>
      </div>
    </PageToolbar>
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
    <div className="space-y-8 pb-12 animate-fade-in">
      {sortedDates.map((dateKey, groupIndex) => (
        <div
          key={dateKey}
          className="relative"
        >
          {/* Sticky Date Header */}
          <div className="sticky top-[124px] z-20 py-3 bg-[var(--color-bg)]/95 backdrop-blur-sm mb-2">
            <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider px-1">
              {formatDateHeader(dateKey === 'Unknown' ? null : dateKey)}
            </h3>
          </div>

          {/* Transactions Card */}
          <Card variant="glass" padding="none" className="overflow-hidden border-[var(--color-border)]/40">
            <div className="divide-y divide-[var(--color-border)]/40">
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
          </Card>
        </div>
      ))}
    </div>
  );
});

// Add display name for debugging
TransactionList.displayName = 'TransactionList';



// Animated Selector Component
const FilterSelector = ({ options, value, onChange, label }) => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--color-fg)] px-1">{label}</label>
      <div className="flex p-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/50 relative">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex-1 relative py-1.5 px-3 text-xs font-medium transition-colors duration-200 z-10 ${isActive ? 'text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId={`selector-bg-${label}`}
                  className="absolute inset-0 bg-[var(--color-accent)] rounded-lg shadow-sm"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

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
  loadingCategoryGroups, categoryGroupsError
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
          // If group matches, show all children
          return group;
        } else if (matchingChildren?.length > 0) {
          // If only children match, show group with filtered children
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
  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      {/* Transaction Type Filter */}
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

      {/* Transaction Status Filter */}
      <FilterSelector
        label="Status"
        value={transactionStatus}
        onChange={setTransactionStatus}
        options={[
          { value: 'all', label: 'All' },
          { value: 'completed', label: 'Completed' },
          { value: 'pending', label: 'Pending' },
          { value: 'attention', label: 'Needs Attention' }
        ]}
      />

      {/* Amount Range Filter */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-fg)] px-1">Amount Range</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-[var(--color-muted)] text-xs">$</span>
            </div>
            <Input
              type="number"
              placeholder="Min"
              value={amountRange.min}
              onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
              className="pl-6 py-2 text-xs bg-[var(--color-surface)] border-[var(--color-border)]/50 focus:border-[var(--color-accent)] rounded-xl w-full"
            />
          </div>
          <span className="text-[var(--color-muted)]">-</span>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-[var(--color-muted)] text-xs">$</span>
            </div>
            <Input
              type="number"
              placeholder="Max"
              value={amountRange.max}
              onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
              className="pl-6 py-2 text-xs bg-[var(--color-surface)] border-[var(--color-border)]/50 focus:border-[var(--color-accent)] rounded-xl w-full"
            />
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-fg)] px-1">Date Range</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'all', label: 'All Time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: '30days', label: 'Last 30 Days' },
            { value: 'custom', label: 'Custom' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all duration-200 ${dateRange === option.value
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm'
                : 'bg-[var(--color-surface)] border-[var(--color-border)]/50 text-[var(--color-muted)] hover:border-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 mt-2 animate-fade-in">
            <Input
              type="date"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
              className="flex-1 py-2 text-xs bg-[var(--color-surface)] border-[var(--color-border)]/50 focus:border-[var(--color-accent)] rounded-xl"
            />
            <span className="text-[var(--color-muted)]">-</span>
            <Input
              type="date"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
              className="flex-1 py-2 text-xs bg-[var(--color-surface)] border-[var(--color-border)]/50 focus:border-[var(--color-accent)] rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-fg)] px-1">
          Categories {(selectedGroupIds.length > 0 || selectedCategoryIds.length > 0) && `(${selectedGroupIds.length + selectedCategoryIds.length})`}
        </label>


        {/* Category Search */}
        <div className="relative mb-2">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-muted)]" />
          <Input
            placeholder="Search categories..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--color-surface)] border-[var(--color-border)]/50 focus:border-[var(--color-accent)] rounded-xl"
          />
        </div>

        <div className="pr-1">
          {loadingCategoryGroups ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-border)]/30 animate-pulse" />
                    <div className="h-4 w-24 bg-[var(--color-border)]/30 rounded animate-pulse" />
                  </div>
                  <div className="flex gap-2 pl-8">
                    <div className="h-6 w-16 bg-[var(--color-border)]/30 rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-[var(--color-border)]/30 rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : categoryGroupsError ? (
            <div className="py-3 px-3 text-xs text-[var(--color-muted)]">{categoryGroupsError}</div>
          ) : (
            <div className="space-y-4">
              {filteredCategoryGroups.map((group) => {
                const isGroupSelected = selectedGroupIds.includes(group.id);
                const isExpanded = expandedGroups[group.id];
                const selectedChildCount = group.system_categories?.filter(c => selectedCategoryIds.includes(c.id)).length || 0;
                const totalChildCount = group.system_categories?.length || 0;
                const isPartiallySelected = selectedChildCount > 0 && selectedChildCount < totalChildCount;

                return (
                  <div key={group.id} className="group/container">
                    {/* Group Header */}
                    <div className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-[var(--color-surface)] transition-colors duration-200">
                      <button
                        onClick={() => toggleGroupExpand(group.id)}
                        className="flex items-center gap-2.5 text-left flex-1 min-w-0 group/header"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-300 group-hover/header:scale-105 group-hover/header:shadow-md"
                          style={{
                            backgroundColor: group.hex_color || 'var(--color-accent)',
                            boxShadow: `0 2px 8px -1px ${group.hex_color}30`
                          }}
                        >
                          <DynamicIcon
                            iconLib={group.icon_lib}
                            iconName={group.icon_name}
                            className="h-3.5 w-3.5 text-white"
                            fallback={FiTag}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[var(--color-fg)] truncate group-hover/header:text-[var(--color-accent)] transition-colors">
                            {group.name}
                          </span>
                          <span className="text-[10px] text-[var(--color-muted)] font-medium">
                            {group.system_categories?.length || 0} categories
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroup(group.id);
                          }}
                          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 ${isGroupSelected
                            ? 'bg-[var(--color-accent)] text-white shadow-sm scale-100'
                            : isPartiallySelected
                              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                              : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]'
                            }`}
                        >
                          {isGroupSelected ? (
                            <FiX className="w-3.5 h-3.5" />
                          ) : isPartiallySelected ? (
                            <div className="w-1.5 h-1.5 rounded-sm bg-current" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded border-2 border-current opacity-30 group-hover/container:opacity-100 transition-opacity" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleGroupExpand(group.id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-all duration-200 ${isExpanded ? 'rotate-180 bg-[var(--color-surface)]' : ''}`}
                        >
                          <FiChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nested Categories (Grid) */}
                    <AnimatePresence initial={false}>
                      {isExpanded && group.system_categories && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-1.5 pl-9 pr-1 pb-2 pt-1">
                            {group.system_categories.map((category, idx) => {
                              const isCatSelected = selectedCategoryIds.includes(category.id);
                              return (
                                <motion.button
                                  key={category.id}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.02, duration: 0.2 }}
                                  onClick={() => toggleCategory(category.id)}
                                  className={`relative group flex items-center gap-2 p-1.5 rounded-md text-[11px] font-medium border transition-all duration-200 text-left ${isCatSelected
                                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/50 text-[var(--color-accent)]'
                                    : 'bg-[var(--color-surface)] border-transparent hover:border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                                    }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200 ${isCatSelected ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)] group-hover:bg-[var(--color-muted)]'
                                    }`} />
                                  <span className="truncate">{category.label}</span>
                                  {isCatSelected && (
                                    <motion.div
                                      layoutId="check"
                                      className="absolute right-1.5 text-[var(--color-accent)]"
                                    >
                                      <FiX className="w-3 h-3" />
                                    </motion.div>
                                  )}
                                </motion.button>
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
  const { profile } = useUser();
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
    if (!profile?.id) return null;

    const params = new URLSearchParams({
      userId: profile.id,
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

    const response = await fetch(`/api/plaid/transactions/get?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return await response.json();
  };

  // Initial fetch
  const fetchInitialTransactions = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError(null);
      if (initialAbortRef.current) initialAbortRef.current.abort();

      const data = await fetchTransactionsData();
      setTransactions(data.transactions || []);
      setNextCursor(data.nextCursor);
      setPrevCursor(data.prevCursor); // Usually null for initial fetch unless we started in middle
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
      const response = await fetch('/api/plaid/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
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
    setTransactions([]);
    setNextCursor(null);
    setPrevCursor(null);
    setSearchQuery(""); // Clear search on refresh
    setDebouncedSearchQuery(""); // Clear debounced search too
    await fetchInitialTransactions();
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
  }, [loadingMore, nextCursor, profile?.id, transactionType, transactionStatus, amountRange, dateRange, customDateRange, selectedGroupIds, selectedCategoryIds, debouncedSearchQuery]);

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
  }, [loadingPrev, prevCursor, profile?.id, transactionType, transactionStatus, amountRange, dateRange, customDateRange, selectedGroupIds, selectedCategoryIds, debouncedSearchQuery]);

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
  }, [profile?.id, debouncedSearchQuery, transactionType, transactionStatus, amountRange, dateRange, customDateRange, selectedGroupIds, selectedCategoryIds]); // Re-fetch when ANY filter changes

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
          .select('id, name, icon_lib, icon_name, hex_color, system_categories(id, label)')
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
    setSelectedTransaction(transaction);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedTransaction(null);
    setCurrentDrawerView('transaction-details');
  };

  const handleCategoryClick = () => {
    setCurrentDrawerView('select-category');
  };

  const handleBackToTransaction = () => {
    setCurrentDrawerView('transaction-details');
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
      const response = await fetch('/api/transactions/detect-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTransaction.id,
          categoryId: category.id,
          userId: profile.id
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
              p_user_id: profile.id,
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

  if ((loading && !debouncedSearchQuery) || !profile?.id) {
    return (
      <PageContainer padding="pt-16 pb-6">
        <SearchToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          loading={isSearchLoading}
          onOpenFilters={() => setIsFiltersOpen(true)}
          activeFilterCount={getActiveFilterCount()}
        />
        <TransactionSkeleton />

        {/* Filters Drawer - Kept here to ensure it's mounted even during loading if needed, though usually loading covers full page */}
        <Drawer
          isOpen={isFiltersOpen}
          onClose={() => setIsFiltersOpen(false)}
          title={
            <div className="flex items-center justify-between w-full pr-8">
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <button
                  onClick={handleClearAllFilters}
                  className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>
          }
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
            selectedCategories={[]} // Legacy prop, not used but kept for interface consistency if needed
          />
        </Drawer>
      </PageContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <PageContainer padding="pt-16 pb-6">
        <SearchToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          loading={isSearchLoading}
          onOpenFilters={() => setIsFiltersOpen(true)}
          activeFilterCount={getActiveFilterCount()}
        />
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <LuReceipt className="h-8 w-8 text-red-500" />
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

  return (
    <PageContainer padding="pt-16 pb-6">
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
        title={
          <div className="flex items-center justify-between w-full pr-8">
            <span>Filters</span>
            {getActiveFilterCount() > 0 && (
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline"
              >
                Clear All
              </button>
            )}
          </div>
        }
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
            content: <TransactionDetails
              transaction={selectedTransaction}
              onCategoryClick={handleCategoryClick}
              onSplitClick={handleSplitClick}
              onRepaymentClick={handleRepaymentClick}
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
              onSplitCreated={() => {
                handleRefresh();
                handleBackToTransaction();
              }}
              onClose={handleBackToTransaction}
            />
          },
          {
            id: 'allocate-repayment',
            title: 'Allocate Repayment',
            showBackButton: true,
            content: <RepaymentView
              transaction={selectedTransaction}
              onRepaymentCreated={() => {
                handleRefresh();
                handleBackToTransaction();
              }}
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
