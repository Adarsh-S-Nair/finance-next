"use client";

import { useEffect, useMemo, useState } from "react";
import { LuTrendingUp } from "react-icons/lu";
import { supabase } from "../../../lib/supabase/client";
import { useUser } from "../../../components/providers/UserProvider";
import { useInvestmentsHeader } from "./InvestmentsHeaderContext";
import { authFetch } from "../../../lib/api/fetch";
import InvestmentsChart from "./InvestmentsChart";
import AllocationCard from "./AllocationCard";
import AccountsCard from "./AccountsCard";

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

function HoldingLogo({ ticker, logo, assetType, size = 40 }) {
  const dim = `${size}px`;
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]/50 bg-[var(--color-surface)]/50"
      style={{ width: dim, height: dim }}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={ticker}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-[11px] font-semibold text-[var(--color-muted)]">
          {assetType === "cash" ? "$" : ticker.slice(0, 3)}
        </span>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */

export default function InvestmentsPage() {
  const { user } = useUser();
  const { setHeaderActions } = useInvestmentsHeader();
  const [accounts, setAccounts] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [tickerMeta, setTickerMeta] = useState({}); // symbol → { logo, name, asset_type }
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
        // Fetch ticker metadata (logo, name, sector) and live quotes in parallel
        const [tickerResult, quoteResult] = await Promise.allSettled([
          supabase
            .from("tickers")
            .select("symbol, name, logo, asset_type, sector")
            .in("symbol", uniqueTickers),
          fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`).then((r) =>
            r.ok ? r.json() : null
          ),
        ]);

        if (tickerResult.status === "fulfilled" && tickerResult.value?.data) {
          const map = {};
          for (const row of tickerResult.value.data) {
            map[row.symbol] = {
              logo: row.logo || null,
              name: row.name || null,
              assetType: row.asset_type || null,
              sector: row.sector || null,
            };
          }
          setTickerMeta(map);
        }

        if (quoteResult.status === "fulfilled" && quoteResult.value?.quotes) {
          setQuotes(quoteResult.value.quotes);
        }
      } else {
        setTickerMeta({});
        setQuotes({});
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
      {/* Summary Section: chart (2/3) + (allocation + accounts stacked) (1/3) */}
      <div className="w-full">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-2/3">
            <InvestmentsChart userId={user?.id} currentValue={totalValue} costBasis={totalCost} />
          </div>
          <div className="flex flex-col gap-8 lg:w-1/3">
            <AllocationCard holdings={holdings} quotes={quotes} totalValue={totalValue} />
            <AccountsCard accounts={accounts} />
          </div>
        </div>
      </div>

      {/* Combined holdings across all accounts — constrained to the 2/3
          column under the chart (same flex layout as the summary row to
          get pixel-exact width alignment), laid out as a 2-column grid. */}
      {combinedHoldings.length > 0 && (
        <div className="flex flex-col gap-6 pt-4 lg:flex-row">
          <div className="lg:w-2/3">
            <div className="mb-6 px-1">
              <h2 className="text-lg font-medium text-[var(--color-fg)]">Holdings</h2>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {combinedHoldings.map((h) => {
              const meta = tickerMeta[h.ticker];
              const displayName = meta?.name || h.ticker;
              return (
                <div key={h.ticker} className="flex items-center gap-3">
                  <HoldingLogo
                    ticker={h.ticker}
                    logo={meta?.logo}
                    assetType={h.asset_type}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {displayName}
                      </span>
                      {displayName !== h.ticker && (
                        <span className="flex-shrink-0 font-mono text-[11px] text-[var(--color-muted)]">
                          {h.ticker}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {formatShares(h.shares)} shares
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
              );
            })}
            </div>
          </div>
          <div className="hidden lg:block lg:w-1/3" />
        </div>
      )}
    </div>
  );
}
