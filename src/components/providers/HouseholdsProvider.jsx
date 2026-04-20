"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useUser } from "./UserProvider";
import { authFetch } from "../../lib/api/fetch";

const HouseholdsContext = createContext({
  households: [],
  loading: false,
  initialized: false,
  error: null,
  refresh: async () => { },
});

export function useHouseholds() {
  return useContext(HouseholdsContext);
}

export default function HouseholdsProvider({ children }) {
  const { user } = useUser();
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);

  const fetchHouseholds = useCallback(async () => {
    if (!user?.id) {
      setHouseholds([]);
      setInitialized(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch("/api/households");
      if (!response.ok) {
        if (response.status === 401 || response.status === 429) {
          setLoading(false);
          return;
        }
        setError(`Failed to load households (${response.status}).`);
        setInitialized(true);
        return;
      }
      const data = await response.json();
      setHouseholds(Array.isArray(data.households) ? data.households : []);
      setInitialized(true);
    } catch (err) {
      console.error("[HouseholdsProvider] fetch error", err);
      setError(err?.message || "Failed to load households.");
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    retryCountRef.current = 0;
    if (user?.id) {
      fetchHouseholds();
    } else {
      setHouseholds([]);
      setInitialized(false);
      setError(null);
    }
  }, [user?.id, fetchHouseholds]);

  // Mirror AccountsProvider's short retry when auth isn't ready on first try.
  useEffect(() => {
    if (user?.id && !initialized && !loading && retryCountRef.current < 3) {
      const timer = setTimeout(() => {
        retryCountRef.current += 1;
        fetchHouseholds();
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (initialized) retryCountRef.current = 0;
  }, [user?.id, initialized, loading, fetchHouseholds]);

  const value = {
    households,
    loading,
    initialized,
    error,
    refresh: fetchHouseholds,
  };

  return (
    <HouseholdsContext.Provider value={value}>
      {children}
    </HouseholdsContext.Provider>
  );
}
