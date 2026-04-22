"use client";

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from './UserProvider';
import { authFetch } from '../../lib/api/fetch';
import { supabase } from '../../lib/supabase/client';
import { transformAccountsData, computeAccountTotals } from '../../lib/accountsTransform';

// Small debounce so a burst of Plaid webhook writes (e.g. item sync
// followed immediately by balance sync) doesn't fire three back-to-back
// /api/plaid/accounts calls. 600ms is short enough to feel instant.
const REALTIME_REFETCH_DEBOUNCE_MS = 600;

export const AccountsContext = createContext();

export function AccountsProvider({ children }) {
  const { user } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Fetch accounts from the database
  const fetchAccounts = async (forceRefresh = false) => {
    if (!user?.id) {
      setAccounts([]);
      setError(null);
      setInitialized(false);
      return;
    }

    // Don't fetch if we already have data and it's not a force refresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < 30000) { // 30 second cache
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await authFetch(`/api/plaid/accounts`);

      if (!response.ok) {
        if (response.status === 401 || response.status === 429) {
          // Auth not ready or rate limited — don't mark as initialized so
          // dashboard doesn't prematurely redirect to /setup. The retry
          // loop below will have another go.
          setLoading(false);
          return;
        }
        // Real server error (5xx, etc.): surface it so the Accounts page
        // can render its error state with a Try Again button. Don't wipe
        // any existing accounts list — keep showing the last-known data.
        const detail =
          response.status >= 500
            ? "We couldn't reach the accounts service. Please try again."
            : `Failed to load accounts (${response.status}).`;
        setError(detail);
        setLastFetched(Date.now());
        setInitialized(true);
        return;
      }

      const data = await response.json();
      const transformedAccounts = transformAccountsData(data.accounts || []);
      setAccounts(transformedAccounts);
      setLastFetched(Date.now());
      setInitialized(true);
    } catch (err) {
      // Network failure / thrown error in the client. Surface the message
      // so the user knows something went wrong — don't silently treat it
      // as "zero accounts," which used to make a transient outage look
      // like an empty connection.
      console.error('[AccountsProvider] Error fetching accounts:', err);
      setError(err?.message || 'Failed to load accounts. Please try again.');
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  // Retry fetching accounts if auth wasn't ready on first try
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (user?.id && !initialized && !loading && retryCountRef.current < 3) {
      const timer = setTimeout(() => {
        retryCountRef.current += 1;
        fetchAccounts();
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (initialized) retryCountRef.current = 0;
  }, [user?.id, initialized, loading]);

  // Load accounts when user changes (not on every navigation)
  useEffect(() => {
    retryCountRef.current = 0;
    if (user?.id) {
      fetchAccounts();
    } else {
      // Clear accounts when user logs out
      setAccounts([]);
      setError(null);
      setLastFetched(null);
      setInitialized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Add account to context (for when new accounts are added)
  // Callers (ConnectingStep, PlaidOAuthHandler) already call refreshAccounts() after
  // processing all accounts, so we don't call it here to avoid redundant fetches.
  const addAccount = (_newAccount) => {
    // no-op: callers handle refreshing
  };

  // Remove account from context
  const removeAccount = (accountId) => {
    setAccounts(prev => {
      return prev.map(institution => ({
        ...institution,
        accounts: institution.accounts.filter(account => account.id !== accountId)
      })).filter(institution => institution.accounts.length > 0);
    });
  };

  // Refresh accounts (force fetch)
  const refreshAccounts = () => {
    fetchAccounts(true);
  };

  // Supabase Realtime: watch plaid_items for this user. Any change —
  // initial backfill completing, webhook flipping sync_status, balance
  // sync writing last_balance_sync — is a signal that the accounts list
  // is now stale and should be refetched. This eliminates the "connect
  // an account, see empty state, hit refresh" dance that used to
  // confuse new users.
  //
  // Scope intentionally narrow: we only listen to plaid_items, not
  // accounts or transactions. All server-side writes to those tables
  // are preceded by a plaid_items UPDATE (status flips, timestamp
  // writes), so this single subscription catches every relevant event
  // while keeping wire traffic minimal.
  const refetchDebounceRef = useRef(null);
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`accounts-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plaid_items',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Debounce: collapse rapid-fire webhook writes into one
          // refetch. Without this, a user who connects an account
          // would see 3-4 back-to-back accounts API calls as the
          // transaction/balance/recurring syncs each tick status.
          if (refetchDebounceRef.current) {
            clearTimeout(refetchDebounceRef.current);
          }
          refetchDebounceRef.current = setTimeout(() => {
            refetchDebounceRef.current = null;
            fetchAccounts(true);
          }, REALTIME_REFETCH_DEBOUNCE_MS);
        }
      )
      .subscribe();

    return () => {
      if (refetchDebounceRef.current) {
        clearTimeout(refetchDebounceRef.current);
        refetchDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Get all accounts as a flat array
  const allAccounts = accounts.flatMap(institution => institution.accounts);
  const { totalAssets, totalLiabilities, totalBalance } = computeAccountTotals(allAccounts);

  const value = {
    accounts,
    allAccounts,
    loading,
    initialized,
    error,
    totalBalance,
    totalAssets,
    totalLiabilities,
    refreshAccounts,
    addAccount,
    removeAccount,
    lastFetched
  };

  return (
    <AccountsContext.Provider value={value}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const context = useContext(AccountsContext);
  if (context === undefined) {
    throw new Error('useAccounts must be used within an AccountsProvider');
  }
  return context;
}
