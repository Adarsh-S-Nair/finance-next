"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LuChevronRight, LuTrendingUp } from "react-icons/lu";
import { supabase } from "../../../lib/supabase/client";
import { useUser } from "../../../components/providers/UserProvider";
import { useInvestmentsHeader } from "./InvestmentsHeaderContext";
import { authFetch } from "../../../lib/api/fetch";

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShares(value) {
  if (value == null || Number.isNaN(value)) return "—";
  const num = Number(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: num < 1 ? 4 : 2,
    maximumFractionDigits: num < 1 ? 6 : 4,
  });
}

export default function InvestmentsPage() {
  const { user } = useUser();
  const { setHeaderActions } = useInvestmentsHeader();
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // All investment accounts for the user, with their institution for logos/names
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("id, name, subtype, balances, institution_id, institutions(name, logo, primary_color)")
        .eq("user_id", user.id)
        .eq("type", "investment")
        .order("name", { ascending: true });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      if (!accountsData || accountsData.length === 0) {
        setHoldings([]);
        setQuotes({});
        setLoading(false);
        return;
      }

      // All holdings across those accounts
      const accountIds = accountsData.map((a) => a.id);
      const { data: holdingsData, error: holdingsError } = await supabase
        .from("holdings")
        .select("id, account_id, ticker, shares, avg_cost, asset_type")
        .in("account_id", accountIds);

      if (holdingsError) throw holdingsError;
      setHoldings(holdingsData || []);

      // Fetch live quotes for all unique tickers so we can display market value
      const uniqueTickers = Array.from(
        new Set((holdingsData || []).map((h) => h.ticker).filter(Boolean))
      );
      if (uniqueTickers.length > 0) {
        try {
          const resp = await fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`);
          if (resp.ok) {
            const quoteJson = await resp.json();
            setQuotes(quoteJson?.quotes || {});
          }
        } catch (quoteErr) {
          console.warn("Failed to fetch quotes", quoteErr);
        }
      }
    } catch (err) {
      console.error("Error loading investments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      // Trigger a fresh holdings sync for every plaid_item that has an
      // investment account, then reload.
      const { data: items } = await supabase
        .from("accounts")
        .select("plaid_item_id")
        .eq("user_id", user.id)
        .eq("type", "investment")
        .not("plaid_item_id", "is", null);

      const unique = Array.from(new Set((items || []).map((r) => r.plaid_item_id)));
      await Promise.all(
        unique.map((plaidItemId) =>
          authFetch("/api/plaid/investments/holdings/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plaidItemId }),
          }).catch((err) => console.warn("sync failed", err))
        )
      );
      await load();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!setHeaderActions) return;
    setHeaderActions({
      onSyncHoldingsClick: handleSync,
      isSyncingHoldings: syncing,
    });
    return () => setHeaderActions({ onSyncHoldingsClick: null, isSyncingHoldings: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing, user?.id]);

  // Aggregate holdings across accounts by ticker, then compute market value from quotes
  const combinedHoldings = useMemo(() => {
    const byTicker = new Map();
    for (const h of holdings) {
      const key = h.ticker;
      const existing = byTicker.get(key);
      if (existing) {
        const totalShares = existing.shares + Number(h.shares || 0);
        const totalCost = existing.avg_cost * existing.shares + Number(h.avg_cost || 0) * Number(h.shares || 0);
        byTicker.set(key, {
          ticker: key,
          shares: totalShares,
          avg_cost: totalShares > 0 ? totalCost / totalShares : 0,
          asset_type: h.asset_type || existing.asset_type,
        });
      } else {
        byTicker.set(key, {
          ticker: key,
          shares: Number(h.shares || 0),
          avg_cost: Number(h.avg_cost || 0),
          asset_type: h.asset_type,
        });
      }
    }

    return Array.from(byTicker.values())
      .map((h) => {
        const quote = quotes[h.ticker];
        const price = quote?.price ?? null;
        const marketValue = price != null ? h.shares * price : h.shares * h.avg_cost;
        const costBasis = h.shares * h.avg_cost;
        const gain = marketValue - costBasis;
        const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
        return { ...h, price, marketValue, costBasis, gain, gainPct };
      })
      .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  }, [holdings, quotes]);

  const totalValue = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (Number(a.balances?.current) || 0), 0);
  }, [accounts]);

  const totalCost = useMemo(() => {
    return combinedHoldings.reduce((sum, h) => sum + (h.costBasis || 0), 0);
  }, [combinedHoldings]);

  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="py-20 text-center">
        <LuTrendingUp className="mx-auto mb-4 h-10 w-10 text-[var(--color-muted)]" />
        <h2 className="text-lg font-medium text-[var(--color-fg)]">No investment accounts</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Connect a brokerage account to see your holdings and portfolio value here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-4">
      {/* Totals */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Total portfolio value
        </div>
        <div className="mt-1 text-3xl font-medium tabular-nums text-[var(--color-fg)]">
          {formatCurrency(totalValue)}
        </div>
        {totalCost > 0 && (
          <div className={`mt-1 text-sm tabular-nums ${totalGain >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {totalGain >= 0 ? "+" : ""}
            {formatCurrency(totalGain)} ({totalGain >= 0 ? "+" : ""}
            {totalGainPct.toFixed(2)}%)
          </div>
        )}
      </div>

      {/* Accounts list */}
      <div>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Accounts
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {accounts.map((account) => {
            const institution = account.institutions;
            return (
              <Link
                key={account.id}
                href={`/investments/${account.id}`}
                className="group flex items-center gap-4 py-4 text-left transition-colors hover:opacity-80"
              >
                <div className="relative h-9 w-9 flex-shrink-0">
                  {institution?.logo && (
                    <img
                      src={institution.logo}
                      alt={institution.name || ""}
                      className="absolute inset-0 h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {(institution?.name || account.name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-[var(--color-fg)]">{account.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {account.subtype || "investment"}
                  </div>
                </div>
                <div className="text-sm tabular-nums text-[var(--color-fg)]">
                  {formatCurrency(account.balances?.current)}
                </div>
                <LuChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-fg)]" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Combined holdings */}
      {combinedHoldings.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Holdings
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {combinedHoldings.map((h) => (
              <div key={h.ticker} className="flex items-center gap-4 py-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                  <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                    {h.ticker.slice(0, 3)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-[var(--color-fg)]">{h.ticker}</div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {formatShares(h.shares)} shares @ {formatCurrency(h.avg_cost)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm tabular-nums text-[var(--color-fg)]">
                    {formatCurrency(h.marketValue)}
                  </div>
                  {h.price != null && (
                    <div
                      className={`mt-0.5 text-xs tabular-nums ${h.gain >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {h.gain >= 0 ? "+" : ""}
                      {h.gainPct.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
