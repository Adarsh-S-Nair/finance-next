"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from './UserProvider';
import { authFetch } from '../../lib/api/fetch';

export const NetWorthContext = createContext();

const NET_WORTH_DISABLED = false;
const NET_WORTH_CACHE_DURATION = 5 * 60 * 1000;

export function NetWorthProvider({ children }) {
  const { user } = useUser();
  const pathname = usePathname();
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [currentNetWorth, setCurrentNetWorth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const abortRef = useRef(null);
  // Fetch net worth data from the API
  const fetchNetWorthData = useCallback(async (forceRefresh = false) => {
    if (NET_WORTH_DISABLED) {
      setLoading(false);
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
      setLastFetched(null);
      return;
    }

    // Don't fetch if we already have data and it's not a force refresh
    if (!forceRefresh && lastFetched && Date.now() - lastFetched < NET_WORTH_CACHE_DURATION) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      
      // Fetch current net worth
      const currentResponse = await authFetch(`/api/net-worth/current`, { signal: controller.signal });
      if (currentResponse.status === 404 || currentResponse.status === 204) {
        // New user with no accounts — not an error, just no data yet
        setCurrentNetWorth(null);
        setNetWorthHistory([]);
        setLastFetched(Date.now());
        return;
      }
      if (!currentResponse.ok) {
        // Any other error (e.g. 401 for new users) — treat as no data, don't throw
        setCurrentNetWorth(null);
        setNetWorthHistory([]);
        setLastFetched(Date.now());
        return;
      }
      const currentData = await currentResponse.json();
      // Handle empty result (no accounts yet)
      if (!currentData || (Array.isArray(currentData) && currentData.length === 0)) {
        setCurrentNetWorth(null);
        setNetWorthHistory([]);
        setLastFetched(Date.now());
        return;
      }
      setCurrentNetWorth(currentData);
      
      // Fetch historical data for the chart (full payload for hover details)
      const historyResponse = await authFetch(`/api/net-worth/by-date?maxDays=365`, { signal: controller.signal });
      if (historyResponse.status === 404 || historyResponse.status === 204) {
        setNetWorthHistory([]);
        setLastFetched(Date.now());
        return;
      }
      if (!historyResponse.ok) {
        // Any history fetch error — treat as no data, don't throw
        setNetWorthHistory([]);
        setLastFetched(Date.now());
        return;
      }
      const historyData = await historyResponse.json();
      
      setNetWorthHistory(historyData.data || []);
      setLastFetched(Date.now());
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Error fetching net worth data:', err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [lastFetched]);

  // Load net worth data when user changes
  useEffect(() => {
    if (NET_WORTH_DISABLED) {
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
      setLastFetched(null);
      return;
    }

    // Skip fetching on the setup page (FTUX) — no accounts yet, no point fetching
    if (pathname === '/setup') {
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
      setLastFetched(null);
      return;
    }

    if (user?.id) {
      fetchNetWorthData();
    } else {
      setNetWorthHistory([]);
      setCurrentNetWorth(null);
      setError(null);
      setLastFetched(null);
    }
    
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [user?.id, pathname, fetchNetWorthData]);

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






