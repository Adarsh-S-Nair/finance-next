"use client";

import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import DynamicIcon from "../../components/DynamicIcon";
import { FiRefreshCw, FiDownload, FiFilter, FiSearch, FiTag } from "react-icons/fi";
import { LuReceipt } from "react-icons/lu";
import { useState, useEffect } from "react";
import { useUser } from "../../components/UserProvider";

// TransactionList component to avoid runtime errors
function TransactionList({ transactions }) {
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
                key={transaction.id}
                transaction={transaction}
                isLast={index === grouped[dateKey].length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// TransactionRow component for individual transactions
function TransactionRow({ transaction, isLast }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  return (
    <div 
      className={`flex items-center justify-between py-4 px-1 hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] transition-colors ${
        !isLast ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_90%)]' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            backgroundColor: transaction.icon_url 
              ? 'var(--color-muted)/10' 
              : (transaction.category_hex_color || 'var(--color-accent)')
          }}
        >
          {transaction.icon_url ? (
            <img 
              src={transaction.icon_url} 
              alt={transaction.merchant_name || transaction.description || 'Transaction'}
              className="w-full h-full object-contain"
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
              display: transaction.icon_url ? 'none' : 'block'
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

  const fetchTransactions = async () => {
    // Don't fetch if profile is not loaded yet
    if (!profile?.id) {
      console.log('Profile not loaded yet, skipping transaction fetch');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/plaid/transactions/get?userId=${profile.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchTransactions();
  };

  const handleSyncTransactions = async () => {
    try {
      const response = await fetch('/api/plaid/transactions/sync-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: profile?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to sync transactions');
      }

      const result = await response.json();
      console.log('Transaction sync completed:', result);
      
      // Refresh transactions after sync
      fetchTransactions();
    } catch (error) {
      console.error('Error syncing transactions:', error);
      alert(`Failed to sync transactions: ${error.message}`);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };


  useEffect(() => {
    fetchTransactions();
  }, [profile?.id]); // Re-fetch when profile loads

  // Show loading state
  if (loading || !profile?.id) {
    return (
      <PageContainer 
        title="Transactions"
        action={
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              variant="ghost"
              size="icon"
              aria-label="Refresh Transactions"
              disabled={loading}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              onClick={handleSyncTransactions}
              variant="ghost"
              size="icon"
              aria-label="Sync Transactions"
              disabled={loading}
            >
              <FiDownload className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
            <p className="text-[var(--color-muted)]">
              {!profile?.id ? 'Loading user profile...' : 'Loading transactions...'}
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <PageContainer 
        title="Transactions"
        action={
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              variant="ghost"
              size="icon"
              aria-label="Refresh Transactions"
              disabled={loading}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              onClick={handleSyncTransactions}
              variant="ghost"
              size="icon"
              aria-label="Sync Transactions"
              disabled={loading}
            >
              <FiDownload className="h-4 w-4" />
            </Button>
          </div>
        }
      >
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
    <PageContainer 
      title="Transactions"
      action={
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleRefresh}
            variant="ghost"
            size="icon"
            aria-label="Refresh Transactions"
            disabled={loading}
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            onClick={handleSyncTransactions}
            variant="ghost"
            size="icon"
            aria-label="Sync Transactions"
            disabled={loading}
          >
            <FiDownload className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost"
            size="icon"
            aria-label="Filter Transactions"
          >
            <FiFilter className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost"
            size="icon"
            aria-label="Search Transactions"
          >
            <FiSearch className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Show empty state if no transactions */}
        {transactions.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              <LuReceipt className="h-8 w-8 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">No transactions found</h3>
            <p className="text-[var(--color-muted)] mb-4">Connect your bank accounts and sync transactions to see your financial activity</p>
            <Button onClick={handleSyncTransactions}>
              Sync Transactions
            </Button>
          </div>
        ) : (
          <TransactionList transactions={transactions} />
        )}
      </div>
    </PageContainer>
  );
}
