"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../../lib/api/fetch";
import { transformAccountsData, computeAccountTotals } from "../../lib/accountsTransform";
import { isLiabilityAccount } from "../../lib/accountUtils";
import { useUser } from "./UserProvider";
import { AccountsContext } from "./AccountsProvider";
import { NetWorthContext } from "./NetWorthProvider";

/**
 * Metadata about the household itself (name, color, members) plus the
 * scope filter: which member ids the user currently has EXCLUDED from
 * the aggregate view. The filter feeds back into AccountsContext and
 * NetWorthContext so every card in the subtree respects it.
 */
const HouseholdMetaContext = createContext({
  household: null,
  members: [],
  memberByUserId: new Map(),
  excludedMemberIds: new Set(),
  /** @type {(userId: string) => void} */
  toggleMember: (userId) => { void userId; },
});

export function useHouseholdMeta() {
  return useContext(HouseholdMetaContext);
}

export default function HouseholdDataProvider({ householdId, children }) {
  const { user } = useUser();
  const [rawInstitutions, setRawInstitutions] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsInitialized, setAccountsInitialized] = useState(false);
  const [accountsError, setAccountsError] = useState(null);
  const [rawCurrentNetWorth, setRawCurrentNetWorth] = useState(null);
  const [rawNetWorthHistory, setRawNetWorthHistory] = useState([]);
  const [netWorthLoading, setNetWorthLoading] = useState(false);
  const [netWorthError, setNetWorthError] = useState(null);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [excludedMemberIds, setExcludedMemberIds] = useState(() => new Set());
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
      setRawInstitutions(transformAccountsData(data.accounts || []));
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
        setRawCurrentNetWorth(null);
        setRawNetWorthHistory([]);
        return;
      }
      const currentData = await currentRes.json();
      setRawCurrentNetWorth(currentData);

      const historyRes = await authFetch(`/api/net-worth/by-date?maxDays=365&${qs}`, { signal: controller.signal });
      if (!historyRes.ok) {
        setRawNetWorthHistory([]);
        return;
      }
      const historyData = await historyRes.json();
      setRawNetWorthHistory(historyData.data || []);
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
      setRawInstitutions([]);
      setAccountsInitialized(false);
      setRawCurrentNetWorth(null);
      setRawNetWorthHistory([]);
      return;
    }
    loadAccounts();
    loadNetWorth();
    loadMeta();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [user?.id, householdId, loadAccounts, loadNetWorth, loadMeta]);

  // Filter institutions + their accounts down to only the included members.
  const filteredInstitutions = useMemo(() => {
    if (excludedMemberIds.size === 0) return rawInstitutions;
    return rawInstitutions
      .map((institution) => ({
        ...institution,
        accounts: institution.accounts.filter(
          (a) => !excludedMemberIds.has(a.userId),
        ),
      }))
      .filter((institution) => institution.accounts.length > 0);
  }, [rawInstitutions, excludedMemberIds]);

  const allAccounts = useMemo(
    () => filteredInstitutions.flatMap((i) => i.accounts),
    [filteredInstitutions],
  );

  const { totalAssets, totalLiabilities, totalBalance } = useMemo(
    () => computeAccountTotals(allAccounts),
    [allAccounts],
  );

  // Rebuild currentNetWorth from the filtered account list so the
  // net-worth card and any consumer of useNetWorth().currentNetWorth
  // matches the filter.
  const currentNetWorth = useMemo(() => {
    if (!rawCurrentNetWorth) return rawCurrentNetWorth;
    if (excludedMemberIds.size === 0) return rawCurrentNetWorth;

    let assets = 0;
    let liabilities = 0;
    const breakdown = [];
    for (const account of allAccounts) {
      const isLiability = isLiabilityAccount(account);
      const balance = account.balance || 0;
      if (isLiability) {
        liabilities += Math.abs(balance);
        breakdown.push({
          accountId: account.id,
          accountName: account.name,
          accountType: account.type,
          balance,
          isLiability: true,
          contribution: -Math.abs(balance),
          lastUpdated: rawCurrentNetWorth.calculatedAt,
        });
      } else {
        assets += balance;
        breakdown.push({
          accountId: account.id,
          accountName: account.name,
          accountType: account.type,
          balance,
          isLiability: false,
          contribution: balance,
          lastUpdated: rawCurrentNetWorth.calculatedAt,
        });
      }
    }

    return {
      ...rawCurrentNetWorth,
      netWorth: Math.round((assets - liabilities) * 100) / 100,
      assets: Math.round(assets * 100) / 100,
      liabilities: Math.round(liabilities * 100) / 100,
      totalAccounts: allAccounts.length,
      accountBreakdown: breakdown,
    };
  }, [rawCurrentNetWorth, allAccounts, excludedMemberIds]);

  // Rebuild netWorthHistory by summing only the included accounts at
  // each date using the per-account balances the server already returns.
  const netWorthHistory = useMemo(() => {
    if (excludedMemberIds.size === 0) return rawNetWorthHistory;
    // Which account ids survive the filter?
    const includedIds = new Set(allAccounts.map((a) => a.id));
    const accountIsLiability = new Map(
      allAccounts.map((a) => [a.id, isLiabilityAccount(a)]),
    );
    return rawNetWorthHistory.map((point) => {
      let assets = 0;
      let liabilities = 0;
      const filteredBalances = {};
      const balances = point.accountBalances || {};
      for (const [accountId, rawBalance] of Object.entries(balances)) {
        if (!includedIds.has(accountId)) continue;
        const balance = Number(rawBalance) || 0;
        filteredBalances[accountId] = balance;
        if (accountIsLiability.get(accountId)) {
          liabilities += Math.abs(balance);
        } else {
          assets += balance;
        }
      }
      return {
        ...point,
        assets: Math.round(assets * 100) / 100,
        liabilities: Math.round(liabilities * 100) / 100,
        netWorth: Math.round((assets - liabilities) * 100) / 100,
        accountBalances: filteredBalances,
      };
    });
  }, [rawNetWorthHistory, allAccounts, excludedMemberIds]);

  const accountsValue = useMemo(
    () => ({
      accounts: filteredInstitutions,
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
    [filteredInstitutions, allAccounts, accountsLoading, accountsInitialized, accountsError, totalBalance, totalAssets, totalLiabilities, loadAccounts],
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

  const toggleMember = useCallback((userId) => {
    setExcludedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const metaValue = useMemo(
    () => ({
      household,
      members,
      memberByUserId,
      excludedMemberIds,
      toggleMember,
    }),
    [household, members, memberByUserId, excludedMemberIds, toggleMember],
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
