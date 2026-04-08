"use client";

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from './UserProvider';
import { authFetch } from '../../lib/api/fetch';
import { isLiabilityAccount } from '../../lib/accountUtils';

const AccountsContext = createContext();

export function AccountsProvider({ children }) {
  const { user } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Transform database accounts to group by institution
  const transformAccountsData = (dbAccounts) => {
    const institutionsMap = {};

    dbAccounts.forEach(account => {
      const institutionId = account.institution_id;
      const institutionName = account.institutions?.name || 'Unknown Bank';
      
      // Create institution entry if it doesn't exist
      if (!institutionsMap[institutionId]) {
        institutionsMap[institutionId] = {
          id: institutionId,
          name: institutionName,
          logo: account.institutions?.logo,
          primaryColor: account.institutions?.primary_color,
          url: account.institutions?.url,
          plaidItemId: account.plaid_item_id,
          accounts: []
        };
      }

      const accountData = {
        id: account.id,
        name: account.name,
        type: account.subtype || account.type,
        balance: account.balances?.current || 0,
        bank: institutionName,
        mask: account.mask,
        institutionId: account.institution_id,
        itemId: account.item_id,
        accountId: account.account_id,
        createdAt: account.created_at
      };

      institutionsMap[institutionId].accounts.push(accountData);
    });

    // Convert to array and sort by institution name
    return Object.values(institutionsMap).sort((a, b) => a.name.localeCompare(b.name));
  };

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
          // dashboard doesn't prematurely redirect to /setup
          setLoading(false);
          return;
        }
        // Other errors: treat as empty
        setAccounts([]);
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
      console.error('Error fetching accounts:', err);
      setAccounts([]);
      setError(null); // Don't surface the error to the UI
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

  // Get all accounts as a flat array
  const allAccounts = accounts.flatMap(institution => institution.accounts);

  // Assets: positive balance accounts that are NOT liability types
  const totalAssets = allAccounts
    .filter(account => account.balance > 0 && !isLiabilityAccount(account))
    .reduce((sum, account) => sum + account.balance, 0);
  
  // Liabilities: negative balance accounts OR liability type accounts (regardless of balance)
  const totalLiabilities = allAccounts
    .filter(account => account.balance < 0 || isLiabilityAccount(account))
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);

  // Net Worth = Assets - Liabilities
  const totalBalance = totalAssets - totalLiabilities;

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
