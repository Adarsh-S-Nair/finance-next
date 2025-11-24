"use client";

import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import DynamicIcon from "../../components/DynamicIcon";
import Drawer from "../../components/ui/Drawer";
import SelectCategoryView from "../../components/SelectCategoryView";
import Card from "../../components/ui/Card";
import { FiRefreshCw, FiFilter, FiSearch, FiTag, FiLoader, FiChevronDown, FiChevronUp, FiX, FiDollarSign, FiCalendar, FiTrendingUp, FiTrendingDown, FiClock } from "react-icons/fi";
import { LuReceipt } from "react-icons/lu";
import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, useTransition, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../../components/UserProvider";
import Input from "../../components/ui/Input";
import { supabase } from "../../lib/supabaseClient";
import PageToolbar from "../../components/PageToolbar";
import TransactionDetails from "../../components/transactions/TransactionDetails";

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
              className="w-full pl-10 pr-4 py-2.5 bg-transparent border-0 outline-none focus:outline-none ring-0 focus:ring-0 focus:border-0 focus-visible:outline-none shadow-none text-sm"
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
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // For other dates, show the formatted date
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Memoize expensive grouping operation
  const { grouped, sortedDates } = useMemo(() => {
    const grouped = {};

    transactions.forEach(transaction => {
      const dateKey = transaction.datetime ? new Date(transaction.datetime).toDateString() : 'Unknown';
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
          className="relative animate-slide-up"
          style={{
            animationDelay: `${groupIndex * 50}ms`,
            animationFillMode: 'backwards'
          }}
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

// TransactionRow component for individual transactions
const TransactionRow = memo(function TransactionRow({ transaction, onTransactionClick, index, groupIndex }) {
  return (
    <div
      data-transaction-item
      data-transaction-id={transaction.id}
      className="group flex items-center justify-between py-4 px-5 hover:bg-[var(--color-surface)]/50 transition-all duration-300 ease-out cursor-pointer hover:scale-[1.005] active:scale-[0.995] animate-fade-in-item"
      style={{
        animationDelay: `${(groupIndex * 50) + (index * 30)}ms`,
        animationFillMode: 'backwards'
      }}
      onClick={() => onTransactionClick(transaction)}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm border border-[var(--color-border)]/20 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md"
          style={{
            backgroundColor: (!DISABLE_LOGOS && transaction.icon_url)
              ? 'var(--color-surface)'
              : (transaction.category_hex_color || 'var(--color-accent)')
          }}
        >
          {(!DISABLE_LOGOS && transaction.icon_url) ? (
            <img
              src={transaction.icon_url}
              alt={transaction.merchant_name || transaction.description || 'Transaction'}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback to category icon if image fails to load
                e.target.style.display = 'none';
                const fallbackIcon = e.target.nextSibling;
                if (fallbackIcon) {
                  fallbackIcon.style.display = 'block';
                }
              }}
            />
          ) : null}
          <DynamicIcon
            iconLib={transaction.category_icon_lib}
            iconName={transaction.category_icon_name}
            className="h-5 w-5 text-white"
            fallback={FiTag}
            style={{
              display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block'
            }}
          />
        </div>
        <div className="min-w-0 flex-1 mr-4">
          <div className="font-medium text-[var(--color-fg)] truncate text-sm transition-colors">
            {transaction.merchant_name || transaction.description || 'Transaction'}
          </div>
          {transaction.category_name && (
            <div className="text-xs text-[var(--color-muted)] mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{transaction.category_name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-semibold text-sm tabular-nums ${transaction.amount > 0 ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
          {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
        </div>
        {transaction.pending && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mt-0.5">
            Pending
          </div>
        )}
      </div>
    </div>
  );
});

// Add display name for debugging
TransactionRow.displayName = 'TransactionRow';

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
              className={`flex-1 relative py-1.5 px-3 text-xs font-medium transition-colors duration-200 z-10 ${isActive ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId={`selector-bg-${label}`}
                  className="absolute inset-0 bg-[var(--color-bg)] rounded-lg shadow-sm border border-[var(--color-border)]/50"
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
          { value: 'pending', label: 'Pending' }
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
                  ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]'
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
        <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-surface)]/30 p-1">
          {loadingCategoryGroups ? (
            <div className="p-3 space-y-2">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[var(--color-border)] animate-pulse" />
                  <div className="h-3 w-32 bg-[var(--color-border)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : categoryGroupsError ? (
            <div className="py-3 px-3 text-xs text-[var(--color-muted)]">{categoryGroupsError}</div>
          ) : (
            <div className="space-y-0.5">
              {categoryGroups.map((group) => {
                const isGroupSelected = selectedGroupIds.includes(group.id);
                const isExpanded = expandedGroups[group.id];
                const hasSelectedChildren = group.system_categories?.some(c => selectedCategoryIds.includes(c.id));

                return (
                  <div key={group.id} className="rounded-lg overflow-hidden">
                    <div className={`flex items-center py-1.5 px-2 transition-colors duration-200 group/item ${isGroupSelected ? 'bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-surface)]'
                      }`}>
                      <button
                        onClick={() => toggleGroupExpand(group.id)}
                        className="p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                      >
                        <FiChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                      </button>

                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="flex-1 flex items-center gap-2 min-w-0 text-left ml-1"
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: group.hex_color || 'var(--color-accent)' }}
                        >
                          <DynamicIcon
                            iconLib={group.icon_lib}
                            iconName={group.icon_name}
                            className="h-2.5 w-2.5 text-white"
                            fallback={FiTag}
                          />
                        </div>
                        <span className={`text-xs font-medium truncate ${isGroupSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]'
                          }`}>
                          {group.name}
                        </span>
                      </button>

                      <div className="flex items-center">
                        <div
                          onClick={() => toggleGroup(group.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 cursor-pointer ${isGroupSelected
                              ? 'bg-[var(--color-accent)] border-[var(--color-accent)] shadow-sm scale-100'
                              : `border-[var(--color-border)] bg-[var(--color-surface)] ${hasSelectedChildren ? 'border-[var(--color-accent)]' : 'group-hover/item:border-[var(--color-muted)]'}`
                            }`}
                        >
                          {isGroupSelected && <FiX className="w-2.5 h-2.5 text-white" />}
                          {!isGroupSelected && hasSelectedChildren && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />}
                        </div>
                      </div>
                    </div>

                    {/* Nested Categories */}
                    <AnimatePresence>
                      {isExpanded && group.system_categories && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-9 pr-2 py-1 space-y-0.5 relative">
                            {/* Vertical line connector */}
                            <div className="absolute left-[1.65rem] top-0 bottom-2 w-px bg-[var(--color-border)]/30" />

                            {group.system_categories.map(category => {
                              const isCatSelected = selectedCategoryIds.includes(category.id);
                              return (
                                <button
                                  key={category.id}
                                  onClick={() => toggleCategory(category.id)}
                                  className={`w-full flex items-center justify-between py-1.5 px-2 rounded-md group/cat relative transition-colors ${isCatSelected ? 'bg-[var(--color-accent)]/5' : 'hover:bg-[var(--color-surface)]'
                                    }`}
                                >
                                  {/* Horizontal connector */}
                                  <div className="absolute left-[-0.6rem] top-1/2 w-2 h-px bg-[var(--color-border)]/30" />

                                  <span className={`text-xs truncate text-left transition-colors ${isCatSelected ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-muted)] group-hover/cat:text-[var(--color-fg)]'
                                    }`}>
                                    {category.label}
                                  </span>
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-200 ${isCatSelected
                                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)] shadow-sm'
                                      : 'border-[var(--color-border)] group-hover/cat:border-[var(--color-muted)] bg-[var(--color-surface)]'
                                    }`}>
                                    {isCatSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>}
                                  </div>
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

export default function TransactionsPage() {
  const { profile } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentDrawerView, setCurrentDrawerView] = useState('transaction-details');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [loadingCategoryGroups, setLoadingCategoryGroups] = useState(false);
  const [categoryGroupsError, setCategoryGroupsError] = useState(null);

  // Filter states
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'week', 'month', '30days', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [transactionType, setTransactionType] = useState('all'); // 'all', 'income', 'expense'
  const [transactionStatus, setTransactionStatus] = useState('all'); // 'all', 'pending', 'completed'

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

  const handleRefresh = () => {
    setTransactions([]);
    setNextCursor(null);
    setPrevCursor(null);
    setSearchQuery(""); // Clear search on refresh
    setDebouncedSearchQuery(""); // Clear debounced search too
    fetchInitialTransactions();
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
              date: keptTransactions[0].datetime,
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
              date: keptTransactions[keptTransactions.length - 1].datetime,
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
    if (isFiltersOpen && categoryGroups.length === 0 && !loadingCategoryGroups) {
      loadCategoryGroups();
    }
  }, [isFiltersOpen, categoryGroups.length, loadingCategoryGroups]);

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

  // Use transactions directly since they are now server-filtered
  const filteredTransactions = transactions;

  // Show loading state with smooth transition
  const isSearchLoading = isPending || loading;

  if ((loading && !debouncedSearchQuery) || !profile?.id) {
    return (
      <PageContainer title="Transactions" padding="pb-6">
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
      <PageContainer title="Transactions" padding="pb-6">
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
    <PageContainer title="Transactions" padding="pb-6">
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
            />
          },
          {
            id: 'select-category',
            title: 'Select Category',
            showBackButton: true,
            content: <SelectCategoryView />
          }
        ]}
        currentViewId={currentDrawerView}
        onViewChange={setCurrentDrawerView}
        onBack={handleBackToTransaction}
      />
    </PageContainer>
  );
}
