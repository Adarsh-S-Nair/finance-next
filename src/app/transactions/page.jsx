"use client";

import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import DynamicIcon from "../../components/DynamicIcon";
import Drawer from "../../components/ui/Drawer";
import SelectCategoryView from "../../components/SelectCategoryView";
import { FiRefreshCw, FiFilter, FiSearch, FiTag } from "react-icons/fi";
import { LuReceipt } from "react-icons/lu";
import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "../../components/UserProvider";
import Input from "../../components/ui/Input";
import { supabase } from "../../lib/supabaseClient";

const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

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
                className={`flex items-center justify-between py-4 px-1 ${
                  index < 3 ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]' : ''
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
function SearchToolbar({ searchQuery, setSearchQuery, onRefresh, loading, onOpenFilters }) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--color-bg)] backdrop-blur-sm border-b border-[var(--color-border)] mb-6">
      <div className="flex items-center gap-4 py-4">
        <div className="flex-1 max-w-4xl">
          <div className="relative rounded-md border border-[color-mix(in_oklab,var(--color-fg),transparent_92%)] bg-[var(--color-content-bg)]">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border-0 outline-none focus:outline-none ring-0 focus:ring-0 focus:border-0 focus-visible:outline-none shadow-none"
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
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost"
            size="icon"
            aria-label="Filter Transactions"
            onClick={onOpenFilters}
          >
            <FiFilter className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// TransactionList component to avoid runtime errors
function TransactionList({ transactions, onTransactionClick }) {
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Group transactions by date
  const groupTransactionsByDate = (transactions) => {
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
  };

  const { grouped, sortedDates } = groupTransactionsByDate(transactions);

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => (
        <div key={dateKey} className="space-y-3">
          {/* Date Header */}
          <div className="py-2 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
            <h3 className="text-sm font-medium text-[var(--color-muted)] tracking-wide">
              {formatDateHeader(dateKey === 'Unknown' ? null : dateKey)}
            </h3>
          </div>
          
          {/* Transactions for this date */}
          <div className="space-y-0">
            {grouped[dateKey].map((transaction, index) => (
              <TransactionRow 
                key={`${transaction.id}-${dateKey}-${index}`}
                transaction={transaction}
                isLast={index === grouped[dateKey].length - 1}
                onTransactionClick={onTransactionClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// TransactionRow component for individual transactions
function TransactionRow({ transaction, isLast, onTransactionClick }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  return (
    <div 
      data-transaction-item
      data-transaction-id={transaction.id}
      className={`flex items-center justify-between py-4 px-1 hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] transition-colors cursor-pointer ${
        !isLast ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]' : ''
      }`}
      onClick={() => onTransactionClick(transaction)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            backgroundColor: (!DISABLE_LOGOS && transaction.icon_url)
              ? 'var(--color-muted)/10'
              : (transaction.category_hex_color || 'var(--color-accent)')
          }}
        >
          {(!DISABLE_LOGOS && transaction.icon_url) ? (
            <img 
              src={transaction.icon_url} 
              alt={transaction.merchant_name || transaction.description || 'Transaction'}
              className="w-full h-full object-contain"
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
        <div className="min-w-0 flex-1 mr-8">
          <div className="font-medium text-[var(--color-fg)] truncate">
            {transaction.merchant_name || transaction.description || 'Transaction'}
          </div>
          {transaction.category_name && (
            <div className="text-xs text-[var(--color-muted)] mt-1 flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: transaction.category_hex_color || 'var(--color-accent)'
                }}
              />
              <span className="truncate">{transaction.category_name}</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-[var(--color-fg)]'}`}>
          {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
        </div>
        {transaction.pending && (
          <div className="text-xs text-[var(--color-muted)] italic">
            Pending
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { profile } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentDrawerView, setCurrentDrawerView] = useState('transaction-details');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [loadingCategoryGroups, setLoadingCategoryGroups] = useState(false);
  const [categoryGroupsError, setCategoryGroupsError] = useState(null);
  const PAGE_LIMIT = 20;
  const initialAbortRef = useRef(null);
  
  // Fetch latest transactions
  const fetchTransactions = async () => {
    if (!profile?.id) {
      console.log('Profile not loaded yet, skipping transaction fetch');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Abort any in-flight initial fetch
      if (initialAbortRef.current) {
        initialAbortRef.current.abort();
      }
      const controller = new AbortController();
      initialAbortRef.current = controller;
      
      const response = await fetch(`/api/plaid/transactions/get?userId=${profile.id}&limit=${PAGE_LIMIT}&minimal=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      const initial = data.transactions || [];
      setTransactions(initial);
      console.log('Loaded', initial.length || 0, 'transactions');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setTransactions([]);
    fetchTransactions();
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  useEffect(() => {
    fetchTransactions();
    return () => {
      if (initialAbortRef.current) initialAbortRef.current.abort();
    };
  }, [profile?.id]);

  // Load category groups when opening Filters (once per session)
  useEffect(() => {
    const loadCategoryGroups = async () => {
      try {
        setLoadingCategoryGroups(true);
        setCategoryGroupsError(null);
        const { data, error } = await supabase
          .from('category_groups')
          .select('id, name, icon_lib, icon_name, hex_color')
          .order('name', { ascending: true });
        if (error) throw error;
        setCategoryGroups(data || []);
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


  // Show loading state
  if (loading || !profile?.id) {
    return (
      <PageContainer title="Transactions" padding="pb-6">
        <SearchToolbar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          loading={loading}
          onOpenFilters={() => setIsFiltersOpen(true)}
        />
        <TransactionSkeleton />
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
          loading={loading}
          onOpenFilters={() => setIsFiltersOpen(true)}
        />
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <LuReceipt className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Error loading transactions</h3>
          <p className="text-[var(--color-muted)] mb-4">{error}</p>
          <Button onClick={fetchTransactions}>
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
        loading={loading}
        onOpenFilters={() => setIsFiltersOpen(true)}
      />
      <div className="space-y-6">
        {/* Show empty state if no transactions */}
        {transactions.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              <LuReceipt className="h-8 w-8 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">No transactions found</h3>
            <p className="text-[var(--color-muted)] mb-4">Connect your bank accounts to see your financial activity</p>
          </div>
        ) : (
          <div data-transaction-list>
            <TransactionList 
              transactions={transactions} 
              onTransactionClick={handleTransactionClick}
            />
            {/* Simple list without infinite scroll */}
          </div>
        )}
      </div>
      
      {/* Filters Drawer */}
      <Drawer
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        title="Filters"
        size="md"
      >
        <div className="p-2">
          <div className="space-y-1">
            <div className="py-4 px-4 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
              <span className="text-sm text-[var(--color-muted)]">Category</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loadingCategoryGroups ? (
                <div className="divide-y divide-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
                  {[...Array(6)].map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-3 px-4">
                      <div className="w-9 h-9 rounded-full bg-[var(--color-border)] animate-pulse" />
                      <div className="h-4 w-40 bg-[var(--color-border)] rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : categoryGroupsError ? (
                <div className="py-4 px-4 text-sm text-[var(--color-muted)]">{categoryGroupsError}</div>
              ) : (
                <div className="divide-y divide-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
                  {categoryGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-3 py-3 px-4 hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] transition-colors cursor-default">
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: group.hex_color || 'var(--color-accent)' }}
                      >
                        <DynamicIcon
                          iconLib={group.icon_lib}
                          iconName={group.icon_name}
                          className="h-5 w-5 text-white"
                          fallback={FiTag}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[var(--color-fg)] truncate">{group.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
            title: 'Transaction Details',
            content: selectedTransaction && (
              <div className="p-2">
                {/* Transaction Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                      style={{
                        backgroundColor: (!DISABLE_LOGOS && selectedTransaction.icon_url)
                          ? 'var(--color-muted)/10'
                          : (selectedTransaction.category_hex_color || 'var(--color-accent)')
                      }}
                    >
                      {(!DISABLE_LOGOS && selectedTransaction.icon_url) ? (
                        <img 
                          src={selectedTransaction.icon_url} 
                          alt={selectedTransaction.merchant_name || selectedTransaction.description || 'Transaction'}
                          className="w-full h-full object-contain"
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
                        iconLib={selectedTransaction.category_icon_lib}
                        iconName={selectedTransaction.category_icon_name}
                        className="h-6 w-6 text-white"
                        fallback={FiTag}
                        style={{
                          display: (!DISABLE_LOGOS && selectedTransaction.icon_url) ? 'none' : 'block'
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[var(--color-fg)] truncate text-lg">
                        {selectedTransaction.merchant_name || selectedTransaction.description || 'Transaction'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className={`font-semibold text-xl ${selectedTransaction.amount > 0 ? 'text-green-600' : 'text-[var(--color-fg)]'}`}>
                      {selectedTransaction.amount > 0 ? '+' : ''}{formatCurrency(selectedTransaction.amount)}
                    </div>
                  </div>
                </div>
                
                {/* Transaction Details Section */}
                <div className="space-y-6">
                  <div className="space-y-0">
                    {/* Status */}
                    <div className="flex justify-between items-center py-4 px-4 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
                      <span className="text-sm text-[var(--color-muted)]">Status</span>
                      <span className={`text-sm ${selectedTransaction.pending ? 'italic' : ''}`}>
                        {selectedTransaction.pending ? 'Pending' : 'Posted'}
                      </span>
                    </div>
                    
                    {/* Category */}
                    {selectedTransaction.category_name && (
                      <div 
                        className="flex justify-between items-center py-4 px-4 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)] cursor-pointer hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] transition-colors"
                        onClick={handleCategoryClick}
                      >
                        <span className="text-sm text-[var(--color-muted)]">Category</span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: selectedTransaction.category_hex_color || 'var(--color-accent)'
                            }}
                          />
                          <span className="text-sm text-[var(--color-fg)]">
                            {selectedTransaction.category_name}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Account */}
                    {selectedTransaction.account_name && (
                      <div className="flex justify-between items-center py-4 px-4 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
                        <span className="text-sm text-[var(--color-muted)]">Account</span>
                        <div className="flex items-center gap-3">
                          {selectedTransaction.accounts?.institutions?.logo && (
                            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                              <img 
                                src={selectedTransaction.accounts.institutions.logo} 
                                alt={selectedTransaction.accounts.institutions.name || 'Institution'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="text-right">
                            <div className="text-sm text-[var(--color-fg)] flex items-center gap-2">
                              <span>{selectedTransaction.account_name}</span>
                              {selectedTransaction.accounts?.mask && (
                                <span className="text-xs text-[var(--color-muted)]">
                                  •••• {selectedTransaction.accounts.mask}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Location */}
                    {selectedTransaction.location && (
                      <div className="flex justify-between items-center py-4 px-4 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]">
                        <span className="text-sm text-[var(--color-muted)]">Location</span>
                        <span className="text-sm text-[var(--color-fg)]">
                          {typeof selectedTransaction.location === 'string' 
                            ? selectedTransaction.location 
                            : selectedTransaction.location.address || 
                              `${selectedTransaction.location.city || ''}, ${selectedTransaction.location.region || ''}`.replace(/^,\s*|,\s*$/g, '') ||
                              'Location available'
                          }
                        </span>
                      </div>
                    )}
                    
                    {/* Date */}
                    {selectedTransaction.datetime && (
                      <div className="flex justify-between items-center py-4 px-4">
                        <span className="text-sm text-[var(--color-muted)]">Date</span>
                        <span className="text-sm text-[var(--color-fg)]">
                          {new Date(selectedTransaction.datetime).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
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

