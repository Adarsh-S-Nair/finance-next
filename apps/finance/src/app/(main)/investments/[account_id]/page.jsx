"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import { useUser } from "../../../../components/providers/UserProvider";
import { formatShares } from "../../../../lib/formatShares";

function formatCurrency(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function InvestmentAccountPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const accountId = params?.account_id;
  const [account, setAccount] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [tickerMeta, setTickerMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!accountId || !user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: acct, error: acctError } = await supabase
          .from("accounts")
          .select("id, name, subtype, balances, institution_id, institutions(name, logo)")
          .eq("id", accountId)
          .eq("user_id", user.id)
          .eq("type", "investment")
          .single();

        if (acctError || !acct) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (cancelled) return;
        setAccount(acct);

        const { data: h, error: hError } = await supabase
          .from("holdings")
          .select("id, ticker, shares, avg_cost, asset_type")
          .eq("account_id", accountId)
          .order("ticker", { ascending: true });

        if (hError) throw hError;
        if (cancelled) return;
        setHoldings(h || []);

        const uniqueTickers = Array.from(new Set((h || []).map((x) => x.ticker).filter(Boolean)));
        if (uniqueTickers.length > 0) {
          const [tickerResult, quoteResult] = await Promise.allSettled([
            supabase
              .from("tickers")
              .select("symbol, name, logo, asset_type")
              .in("symbol", uniqueTickers),
            fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`).then((r) =>
              r.ok ? r.json() : null
            ),
          ]);

          if (!cancelled) {
            if (tickerResult.status === "fulfilled" && tickerResult.value?.data) {
              const map = {};
              for (const row of tickerResult.value.data) {
                map[row.symbol] = {
                  logo: row.logo || null,
                  name: row.name || null,
                  assetType: row.asset_type || null,
                };
              }
              setTickerMeta(map);
            }
            if (quoteResult.status === "fulfilled" && quoteResult.value?.quotes) {
              setQuotes(quoteResult.value.quotes);
            }
          }
        }
      } catch (err) {
        console.error("Error loading account:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, user?.id]);

  const enrichedHoldings = useMemo(() => {
    return holdings
      .map((h) => {
        const quote = quotes[h.ticker];
        const price = quote?.price ?? null;
        const shares = Number(h.shares || 0);
        const avgCost = Number(h.avg_cost || 0);
        const marketValue = price != null ? shares * price : shares * avgCost;
        const costBasis = shares * avgCost;
        const gain = marketValue - costBasis;
        const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0;
        return { ...h, shares, avg_cost: avgCost, price, marketValue, costBasis, gain, gainPct };
      })
      .sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  }, [holdings, quotes]);

  const totalValue = Number(account?.balances?.current) || 0;
  const totalCost = useMemo(
    () => enrichedHoldings.reduce((sum, h) => sum + (h.costBasis || 0), 0),
    [enrichedHoldings]
  );
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
      </div>
    );
  }

  if (notFound || !account) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-medium text-[var(--color-fg)]">Account not found</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This investment account doesn&apos;t exist or isn&apos;t yours.
        </p>
        <button
          type="button"
          onClick={() => router.push("/investments")}
          className="mt-6 text-sm text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-fg)]"
        >
          Back to investments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-4">
      {/* Totals */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          {account.subtype || "Investment"} value
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

      {/* Holdings */}
      <div>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Holdings
        </div>
        {enrichedHoldings.length === 0 ? (
          <div className="py-6 text-sm text-[var(--color-muted)]">No holdings on this account yet.</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {enrichedHoldings.map((h) => {
              const meta = tickerMeta[h.ticker];
              const displayName = meta?.name || h.ticker;
              return (
                <div key={h.id} className="flex items-center gap-4 py-4">
                  <div
                    className="relative flex-shrink-0 overflow-hidden rounded-full border border-[var(--color-border)]/50 bg-[var(--color-surface)]/50"
                    style={{ width: 40, height: 40 }}
                  >
                    {meta?.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={meta.logo}
                        alt={h.ticker}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                        {h.asset_type === "cash" ? "$" : h.ticker.slice(0, 3)}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-fg)]">
                        {displayName}
                      </span>
                      {displayName !== h.ticker && (
                        <span className="flex-shrink-0 font-mono text-[11px] text-[var(--color-muted)]">
                          {h.ticker}
                        </span>
                      )}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
