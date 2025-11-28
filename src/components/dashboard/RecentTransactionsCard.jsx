"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  const DISABLE_LOGOS = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';
  const { user } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Fetch recent transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        // Abort any in-flight request
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch(`/api/plaid/transactions/get?userId=${user.id}&limit=8&minimal=1`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const result = await response.json();
        // Use up to 4 most recent transactions for this small card
        setTransactions((result.transactions || []).slice(0, 4));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('Error fetching transactions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [user?.id]);

  if (loading) {
    return (
      <Card width="full" className="animate-pulse" variant="glass">
        <div className="mb-4 flex justify-between items-center">
          <div className="h-4 bg-[var(--color-border)] rounded w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-2">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-8 h-8 bg-[var(--color-border)] rounded-full flex-shrink-0" />
                <div className="h-4 bg-[var(--color-border)] rounded w-32" />
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
      <Card width="full" variant="glass">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)] font-light">Recent Transactions</div>
          <div className="text-lg font-light text-[var(--color-fg)]">Unable to load</div>
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
      <Card width="full" variant="glass">
        <div className="mb-4">
          <div className="text-sm text-[var(--color-muted)] font-light">Recent Transactions</div>
          <div className="text-lg font-light text-[var(--color-fg)]">No transactions</div>
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
    <Card width="full" variant="glass">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-[var(--color-muted)] font-light uppercase tracking-wider">Recent Transactions</div>
        {transactions.length >= 4 && (
          <button className="text-sm text-[var(--color-accent)] hover:underline font-light">
            View all
          </button>
        )}
      </div>

      <div className="space-y-1">
        {transactions.map((transaction, index) => {
          const isPositive = transaction.amount > 0;
          // Use generic positive/neutral colors which map to neon in dark mode via CSS variables if configured,
          // or explicit neon classes if we want to force it.
          const amountColor = isPositive ? 'text-green-600 dark:text-neon-green' : 'text-[var(--color-fg)]';

          return (
            <div
              key={transaction.id || index}
              className="flex items-center justify-between py-2 px-2 rounded-sm hover:bg-[var(--color-muted)]/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
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
                    className="h-4 w-4 text-white"
                    fallback={FiTag}
                    style={{
                      display: (!DISABLE_LOGOS && transaction.icon_url) ? 'none' : 'block'
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 mr-4">
                  <div className="text-sm font-light text-[var(--color-fg)] truncate">
                    {transaction.merchant_name || transaction.description || transaction.name || 'Transaction'}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-medium ${amountColor}`}>
                  {isPositive ? '+' : ''}{formatCurrency(transaction.amount)}
                </div>
                {transaction.pending && (
                  <div className="text-xs text-[var(--color-muted)] italic font-light">
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
