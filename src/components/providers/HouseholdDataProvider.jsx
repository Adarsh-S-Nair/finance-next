"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../../lib/api/fetch";
import { transformAccountsData, computeAccountTotals } from "../../lib/accountsTransform";
import { useUser } from "./UserProvider";
import { AccountsContext } from "./AccountsProvider";
import { NetWorthContext } from "./NetWorthProvider";

/**
 * Metadata about the household itself (name, color, members). Pages under
 * /households/[id] consume this via useHouseholdMeta() to render things
 * like an account row's owner chip.
 */
const HouseholdMetaContext = createContext({
  household: null,
  members: [],
  memberByUserId: new Map(),
});

export function useHouseholdMeta() {
  return useContext(HouseholdMetaContext);
}

/**
 * HouseholdDataProvider overrides AccountsContext + NetWorthContext with
 * household-scoped data so any page rendered inside it (the entire
 * /households/[id]/* subtree) transparently sees the aggregated household
 * view without needing its own hooks.
 *
 * It proxies the same three endpoints AccountsProvider and NetWorthProvider
 * hit, but with ?householdId=<id> appended.
 */
export default function HouseholdDataProvider({ householdId, children }) {
  const { user } = useUser();
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsInitialized, setAccountsInitialized] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [currentNetWorth, setCurrentNetWorth] = useState(null);
  const [netWorthHistory, setNetWorthHistory] = useState([]);
  const [netWorthLoading, setNetWorthLoading] = useState(false);
  const [netWorthError, setNetWorthError] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const abortRef = useRef(null);

  const loadMeta = useCallback(async () => {
    if (!householdId) return;
    try {
      const res = await authFetch(`/api/households/${householdId}`);
      if (!res.ok) return;
      const data = await res.json();
      setHousehold(data.household || null);
      setMembers(data.members || []);
    } catch (err) {
      console.error("[household data] meta fetch error", err);
    }
  }, [householdId]);

  const loadAccounts = useCallback(async () => {
    if (!householdId) return;
    try {
      setAccountsLoading(true);
      setAccountsError(null);
      const response = await authFetch(`/api/plaid/accounts?householdId=${encodeURIComponent(householdId)}`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 429) {
          setAccountsLoading(false);
          return;
        }
        setAccountsError(`Failed to load accounts (${response.status}).`);
        setAccountsInitialized(true);
        return;
      }
      const data = await response.json();
      setAccounts(transformAccountsData(data.accounts || []));
      setAccountsInitialized(true);
    } catch (err) {
      console.error("[household data] accounts fetch error", err);
      setAccountsError(err?.message || "Failed to load accounts.");
      setAccountsInitialized(true);
    } finally {
      setAccountsLoading(false);
    }
  }, [householdId]);

  const loadNetWorth = useCallback(async () => {
    if (!householdId) return;
    try {
      setNetWorthLoading(true);
      setNetWorthError(null);
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const qs = `householdId=${encodeURIComponent(householdId)}`;
      const currentRes = await authFetch(`/api/net-worth/current?${qs}`, { signal: controller.signal });
      if (!currentRes.ok) {
        setCurrentNetWorth(null);
        setNetWorthHistory([]);
        return;
      }
      const currentData = await currentRes.json();
      setCurrentNetWorth(currentData);

      const historyRes = await authFetch(`/api/net-worth/by-date?maxDays=365&${qs}`, { signal: controller.signal });
      if (!historyRes.ok) {
        setNetWorthHistory([]);
        return;
      }
      const historyData = await historyRes.json();
      setNetWorthHistory(historyData.data || []);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("[household data] net worth fetch error", err);
        setNetWorthError(err?.message || "Failed to load net worth.");
      }
    } finally {
      setNetWorthLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!user?.id || !householdId) {
      setAccounts([]);
      setAccountsInitialized(false);
      setCurrentNetWorth(null);
      setNetWorthHistory([]);
      return;
    }
    loadAccounts();
    loadNetWorth();
    loadMeta();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [user?.id, householdId, loadAccounts, loadNetWorth, loadMeta]);

  const allAccounts = accounts.flatMap((i) => i.accounts);
  const { totalAssets, totalLiabilities, totalBalance } = computeAccountTotals(allAccounts);

  const accountsValue = useMemo(
    () => ({
      accounts,
      allAccounts,
      loading: accountsLoading,
      initialized: accountsInitialized,
      error: accountsError,
      totalBalance,
      totalAssets,
      totalLiabilities,
      refreshAccounts: loadAccounts,
      addAccount: () => { },
      removeAccount: () => { },
      lastFetched: null,
    }),
    [accounts, allAccounts, accountsLoading, accountsInitialized, accountsError, totalBalance, totalAssets, totalLiabilities, loadAccounts],
  );

  const netWorthValue = useMemo(
    () => ({
      netWorthHistory,
      currentNetWorth,
      loading: netWorthLoading,
      error: netWorthError,
      refreshNetWorthData: loadNetWorth,
      isDataStale: () => false,
      getCacheAge: () => null,
      lastFetched: null,
    }),
    [netWorthHistory, currentNetWorth, netWorthLoading, netWorthError, loadNetWorth],
  );

  const memberByUserId = useMemo(() => {
    const map = new Map();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  const metaValue = useMemo(
    () => ({ household, members, memberByUserId }),
    [household, members, memberByUserId],
  );

  return (
    <HouseholdMetaContext.Provider value={metaValue}>
      <AccountsContext.Provider value={accountsValue}>
        <NetWorthContext.Provider value={netWorthValue}>
          {children}
        </NetWorthContext.Provider>
      </AccountsContext.Provider>
    </HouseholdMetaContext.Provider>
  );
}
