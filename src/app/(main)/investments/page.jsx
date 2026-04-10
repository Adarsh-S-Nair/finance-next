"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LuChevronRight, LuTrendingUp } from "react-icons/lu";
import { PiBankFill } from "react-icons/pi";
import { supabase } from "../../../lib/supabase/client";
import { useUser } from "../../../components/providers/UserProvider";
import { useInvestmentsHeader } from "./InvestmentsHeaderContext";
import { authFetch } from "../../../lib/api/fetch";
import InvestmentsChart from "./InvestmentsChart";
import AllocationCard from "./AllocationCard";

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function formatShares(value) {
  if (value == null || Number.isNaN(value)) return "—";
  const num = Number(value);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: num < 1 ? 4 : 2,
    maximumFractionDigits: num < 1 ? 6 : 4,
  });
}

/* ── Sub-components ──────────────────────────────────────── */

function CategoryHeader({ title, total, isFirst }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 ${isFirst ? "" : "pt-5"}`}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)] opacity-80">
        {title}
      </h3>
      <div className="text-xs font-semibold tabular-nums text-[var(--color-muted)]">
        {formatCurrency(total)}
      </div>
    </div>
  );
}

function AccountRow({ account, institution }) {
  return (
    <Link
      href={`/investments/${account.id}`}
      className="group flex items-center justify-between rounded-lg px-5 py-3.5 transition-all duration-200 hover:bg-[var(--color-card-highlight)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)]/50 bg-[var(--color-surface)]/50">
          {institution?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={institution.logo}
              alt={institution.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`h-full w-full items-center justify-center ${institution?.logo ? "hidden" : "flex"}`}
          >
            <PiBankFill className="h-4 w-4 text-[var(--color-muted)]" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-sm font-medium text-[var(--color-fg)]">{account.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span className="max-w-[180px] truncate">{institution?.name || "Unknown"}</span>
            {account.mask && (
              <>
                <span className="text-[var(--color-border)]">•</span>
                <span className="font-mono">•••• {account.mask}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="ml-4 flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-[var(--color-fg)]">
            {formatCurrency(account.balances?.current)}
          </div>
        </div>
        <LuChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-fg)]" />
      </div>
    </Link>
  );
}

/* ── Main page ───────────────────────────────────────────── */

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
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select(
          "id, name, subtype, mask, balances, institution_id, institutions(id, name, logo, primary_color)"
        )
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

      const accountIds = accountsData.map((a) => a.id);
      const { data: holdingsData, error: holdingsError } = await supabase
        .from("holdings")
        .select("id, account_id, ticker, shares, avg_cost, asset_type")
        .in("account_id", accountIds);

      if (holdingsError) throw holdingsError;
      setHoldings(holdingsData || []);

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

  // Aggregate holdings across accounts by ticker for the bottom holdings list
  const combinedHoldings = useMemo(() => {
    const byTicker = new Map();
    for (const h of holdings) {
      const key = h.ticker;
      const existing = byTicker.get(key);
      if (existing) {
        const totalShares = existing.shares + Number(h.shares || 0);
        const totalCost =
          existing.avg_cost * existing.shares +
          Number(h.avg_cost || 0) * Number(h.shares || 0);
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

  // Group accounts by institution for the "All Accounts" section
  const accountsByInstitution = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      const inst = account.institutions || {};
      const key = inst.id || account.institution_id || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: inst.name || "Unknown",
          logo: inst.logo || null,
          accounts: [],
          total: 0,
        });
      }
      const entry = map.get(key);
      entry.accounts.push(account);
      entry.total += Number(account.balances?.current) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [accounts]);

  const totalValue = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (Number(a.balances?.current) || 0), 0);
  }, [accounts]);

  const totalCost = useMemo(() => {
    return combinedHoldings.reduce((sum, h) => sum + (h.costBasis || 0), 0);
  }, [combinedHoldings]);

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
    <div className="space-y-8">
      {/* Summary Section: chart (2/3) + allocation (1/3) */}
      <div className="w-full">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-2/3">
            <InvestmentsChart userId={user?.id} currentValue={totalValue} costBasis={totalCost} />
          </div>
          <div className="lg:w-1/3">
            <AllocationCard holdings={holdings} quotes={quotes} totalValue={totalValue} />
          </div>
        </div>
      </div>

      {/* All Accounts grouped by institution */}
      <div className="pt-4">
        <div className="mb-6 px-1">
          <h2 className="text-lg font-medium text-[var(--color-fg)]">All Accounts</h2>
        </div>

        <div className="overflow-hidden">
          {accountsByInstitution.map((inst, i) => (
            <div key={inst.id}>
              <CategoryHeader title={inst.name} total={inst.total} isFirst={i === 0} />
              {inst.accounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  institution={{ name: inst.name, logo: inst.logo }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Combined holdings across all accounts */}
      {combinedHoldings.length > 0 && (
        <div className="pt-4">
          <div className="mb-6 px-1">
            <h2 className="text-lg font-medium text-[var(--color-fg)]">Holdings</h2>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {combinedHoldings.map((h) => (
              <div key={h.ticker} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-border)]/50 bg-[var(--color-surface)]/50">
                  <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                    {h.ticker.slice(0, 3)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 truncate text-sm font-medium text-[var(--color-fg)]">
                    {h.ticker}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {formatShares(h.shares)} shares @ {formatCurrency(h.avg_cost)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-[var(--color-fg)]">
                    {formatCurrency(h.marketValue)}
                  </div>
                  {h.price != null && (
                    <div
                      className={`mt-0.5 text-xs font-medium tabular-nums ${h.gain >= 0 ? "text-emerald-500" : "text-rose-500"}`}
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
