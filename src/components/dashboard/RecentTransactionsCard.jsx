"use client";

import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { useUser } from '../UserProvider';
import DynamicIcon from '../DynamicIcon';
import { FiTag } from 'react-icons/fi';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return 'Today';
  } else if (diffDays === 2) {
    return 'Yesterday';
  } else if (diffDays <= 7) {
    return `${diffDays - 1} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}


export default function RecentTransactionsCard() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch recent transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/plaid/transactions/get?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }
        
        const result = await response.json();
        // Get the most recent 4 transactions
        setTransactions((result.transactions || []).slice(0, 4));
        
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user?.id]);

  if (loading) {
    return (
      <Card width="2/3" className="animate-pulse">
        <div className="mb-4">
          <div className="h-5 bg-[var(--color-border)] rounded w-32 mb-2" />
          <div className="h-4 bg-[var(--color-border)] rounded w-24" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--color-border)] rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-[var(--color-border)] rounded w-24 mb-1" />
                <div className="h-3 bg-[var(--color-border)] rounded w-16" />
              </div>
              <div className="h-4 bg-[var(--color-border)] rounded w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card width="2/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Recent Transactions</div>
          <div className="text-lg font-semibold text-[var(--color-fg)]">Unable to load</div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-[var(--color-muted)] mb-2">
                {error}
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card width="2/3">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)]">Recent Transactions</div>
          <div className="text-lg font-semibold text-[var(--color-fg)]">No transactions</div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-[var(--color-muted)] mb-2">
                No recent transactions found
              </div>
              <div className="text-xs text-[var(--color-muted)]">
                Connect accounts to see your transaction history
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card width="2/3">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-[var(--color-muted)]">Recent Transactions</div>
        {transactions.length >= 4 && (
          <button className="text-sm text-[var(--color-accent)] hover:underline">
            View all
          </button>
        )}
      </div>
      
      <div className="space-y-1">
        {transactions.map((transaction, index) => {
          const isPositive = transaction.amount > 0;
          const amountColor = isPositive ? 'text-green-600' : 'text-[var(--color-fg)]';
          
          return (
            <div 
              key={transaction.id || index} 
              className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-[var(--color-muted)]/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
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
                    className="h-4 w-4 text-white"
                    fallback={FiTag}
                    style={{
                      display: transaction.icon_url ? 'none' : 'block'
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 mr-4">
                  <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                    {transaction.merchant_name || transaction.description || transaction.name || 'Transaction'}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-medium ${amountColor}`}>
                  {isPositive ? '+' : ''}{formatCurrency(transaction.amount)}
                </div>
                {transaction.pending && (
                  <div className="text-xs text-[var(--color-muted)] italic">
                    Pending
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
    </Card>
  );
}
