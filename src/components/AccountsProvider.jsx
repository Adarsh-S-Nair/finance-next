"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserProvider';

const AccountsContext = createContext();

export function AccountsProvider({ children }) {
  const { user } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
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
        accountId: account.account_id
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
      return;
    }

    // Don't fetch if we already have data and it's not a force refresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < 30000) { // 30 second cache
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/plaid/accounts?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      
      const data = await response.json();
      const transformedAccounts = transformAccountsData(data.accounts || []);
      setAccounts(transformedAccounts);
      setLastFetched(Date.now());
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load accounts when user changes
  useEffect(() => {
    if (user?.id) {
      fetchAccounts();
    } else {
      // Clear accounts when user logs out
      setAccounts([]);
      setError(null);
      setLastFetched(null);
    }
  }, [user?.id]);

  // Add account to context (for when new accounts are added)
  const addAccount = (newAccount) => {
    // This function is now simplified since we refresh accounts after adding
    // The actual account addition is handled by the database and refresh
    refreshAccounts();
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

  // Helper function to determine if an account is a liability
  const isLiabilityAccount = (account) => {
    const liabilityTypes = [
      'credit card',
      'credit',
      'loan',
      'mortgage',
      'line of credit',
      'overdraft',
      'other'
    ];
    
    const accountType = (account.type || '').toLowerCase();
    return liabilityTypes.some(type => accountType.includes(type));
  };

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
