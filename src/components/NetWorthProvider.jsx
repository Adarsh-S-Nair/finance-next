"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from './UserProvider';

const NetWorthContext = createContext();

export function NetWorthProvider({ children }) {
  const { user } = useUser();
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [currentNetWorth, setCurrentNetWorth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Cache duration: 5 minutes (300000ms)
  const CACHE_DURATION = 5 * 60 * 1000;

  // Fetch net worth data from the API
  const fetchNetWorthData = async (forceRefresh = false) => {
    if (!user?.id) {
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
      setLastFetched(null);
      return;
    }

    // Don't fetch if we already have data and it's not a force refresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch current net worth
      const currentResponse = await fetch(`/api/net-worth/current?userId=${user.id}`);
      if (!currentResponse.ok) {
        throw new Error('Failed to fetch current net worth');
      }
      const currentData = await currentResponse.json();
      setCurrentNetWorth(currentData);
      
      // Fetch historical data for the chart
      const historyResponse = await fetch(`/api/net-worth/by-date?userId=${user.id}`);
      if (!historyResponse.ok) {
        throw new Error('Failed to fetch net worth history');
      }
      const historyData = await historyResponse.json();
      
      setNetWorthHistory(historyData.data || []);
      setLastFetched(Date.now());
    } catch (err) {
      console.error('Error fetching net worth data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load net worth data when user changes
  useEffect(() => {
    if (user?.id) {
      fetchNetWorthData();
    } else {
      // Clear data when user logs out
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
      setLastFetched(null);
    }
  }, [user?.id]);

  // Refresh net worth data (force fetch)
  const refreshNetWorthData = () => {
    fetchNetWorthData(true);
  };

  // Check if data is stale (older than cache duration)
  const isDataStale = () => {
    return !lastFetched || Date.now() - lastFetched >= CACHE_DURATION;
  };

  // Get cache age in minutes
  const getCacheAge = () => {
    if (!lastFetched) return null;
    return Math.floor((Date.now() - lastFetched) / (1000 * 60));
  };

  const value = {
    netWorthHistory,
    currentNetWorth,
    loading,
    error,
    refreshNetWorthData,
    isDataStale,
    getCacheAge,
    lastFetched
  };

  return (
    <NetWorthContext.Provider value={value}>
      {children}
    </NetWorthContext.Provider>
  );
}

export function useNetWorth() {
  const context = useContext(NetWorthContext);
  if (context === undefined) {
    throw new Error('useNetWorth must be used within a NetWorthProvider');
  }
  return context;
}
