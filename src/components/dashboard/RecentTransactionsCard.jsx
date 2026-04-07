"use client";

import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../../lib/api/fetch';
import { useUser } from '../providers/UserProvider';
import DynamicIcon from '../DynamicIcon';
import { FiTag } from 'react-icons/fi';
import Link from 'next/link';
import ViewAllLink from '../ui/ViewAllLink';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString) {
  if (!dateString) return '';

  // If dateString is YYYY-MM-DD (from new date column), parse it as UTC midnight
  // If it's ISO datetime (from old datetime column), it's also UTC
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

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays > 0 && diffDays <= 7) {
    return `${diffDays} days ago`;
  } else {
    // Format as "Nov 28" using UTC components to ensure it stays as 28th
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC' // Force UTC timezone for formatting
    }).format(date);
  }
}


const DISABLE_LOGOS_DASH = process.env.NEXT_PUBLIC_DISABLE_MERCHANT_LOGOS === '1';

function TransactionIconCircle({ transaction }) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const showLogo = !DISABLE_LOGOS_DASH && transaction.icon_url && !logoFailed;

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        backgroundColor: showLogo
          ? 'transparent'
          : (transaction.category_hex_color || 'var(--color-accent)')
      }}
    >
      {showLogo ? (
        <img
          src={transaction.icon_url}
          alt={transaction.merchant_name || transaction.description || 'Transaction'}
          className="w-full h-full object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <DynamicIcon
          iconLib={transaction.category_icon_lib}
          iconName={transaction.category_icon_name}
          className="h-4 w-4 text-white"
          fallback={FiTag}
        />
      )}
    </div>
  );
}

export default function RecentTransactionsCard() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Fetch recent transactions with retry on failure
  const retryTimerRef = useRef(null);
  useEffect(() => {
    const fetchTransactions = async (retries = 2) => {
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

        const response = await authFetch(`/api/plaid/transactions/get?limit=8&minimal=1`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const result = await response.json();
        setTransactions((result.transactions || []).slice(0, 5));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error('Error fetching transactions:', err);
        if (retries > 0) {
          retryTimerRef.current = setTimeout(() => fetchTransactions(retries - 1), 1500);
          return;
        }
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="w-full animate-pulse">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <div className="card-header">Recent Transactions</div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-2">
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
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <div className="card-header">Recent Transactions</div>
        </div>
        <div className="pt-4">
          <div className="h-40 w-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-2">
                No recent transactions found
              </div>
              <div className="text-xs text-zinc-400">
                Connect accounts to see your transaction history
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="card-header">Recent Transactions</h3>
        <ViewAllLink href="/transactions" />
      </div>

      <div className="space-y-1">
        {transactions.map((transaction, index) => {
          const isPositive = transaction.amount > 0;
          const amountColor = isPositive ? 'text-[var(--color-success)]' : 'text-zinc-900';

          return (
            <div
              key={transaction.id || index}
              className="flex items-center justify-between py-3 px-2"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <TransactionIconCircle transaction={transaction} />
                <div className="min-w-0 flex-1 mr-4">
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {transaction.merchant_name || transaction.description || transaction.name || 'Transaction'}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {formatDate(transaction.date || transaction.datetime)}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-sm font-medium ${amountColor}`}>
                  {isPositive ? '+' : ''}{formatCurrency(transaction.amount)}
                </div>
                {transaction.pending && (
                  <div className="text-xs text-zinc-400 italic">
                    Pending
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
