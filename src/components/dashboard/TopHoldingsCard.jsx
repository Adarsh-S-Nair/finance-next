"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase/client";
import { useUser } from "../providers/UserProvider";
import ViewAllLink from "../ui/ViewAllLink";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function formatShares(value) {
  const num = Number(value || 0);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: num < 1 ? 4 : 2,
    maximumFractionDigits: num < 1 ? 6 : 4,
  });
}

/**
 * Tiny inline SVG sparkline — 30-day daily close.
 */
function Sparkline({ data, width = 64, height = 24 }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 2;
  const drawableH = height - padY * 2;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = padY + drawableH - ((val - min) / range) * drawableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} className="flex-shrink-0 overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "#10b981" : "#f43f5e"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HoldingLogo({ ticker, logo, assetType, size = 32 }) {
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
        <span className="text-[10px] font-semibold text-[var(--color-muted)]">
          {assetType === "cash" ? "$" : ticker.slice(0, 3)}
        </span>
      </div>
    </div>
  );
}

const MAX_DISPLAY = 5;

export default function TopHoldingsCard() {
  const { user, isPro } = useUser();
  const [holdings, setHoldings] = useState([]);
  const [tickerMeta, setTickerMeta] = useState({});
  const [quotes, setQuotes] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Investment accounts
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "investment");

        if (!accounts || accounts.length === 0) {
          if (!cancelled) {
            setHoldings([]);
            setLoading(false);
          }
          return;
        }

        const accountIds = accounts.map((a) => a.id);

        // All holdings
        const { data: holdingsData } = await supabase
          .from("holdings")
          .select("ticker, shares, avg_cost, asset_type")
          .in("account_id", accountIds);

        if (!holdingsData || holdingsData.length === 0) {
          if (!cancelled) {
            setHoldings([]);
            setLoading(false);
          }
          return;
        }

        // Aggregate by ticker
        const byTicker = new Map();
        for (const h of holdingsData) {
          const key = h.ticker;
          const existing = byTicker.get(key);
          if (existing) {
            const totalShares = existing.shares + Number(h.shares || 0);
            const totalCost =
              existing.avg_cost * existing.shares + Number(h.avg_cost || 0) * Number(h.shares || 0);
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

        const aggregated = Array.from(byTicker.values());
        const uniqueTickers = aggregated
          .map((h) => h.ticker)
          .filter((t) => t && !t.startsWith("CUR:"));

        // Fetch ticker meta + quotes in parallel
        const [tickerResult, quoteResult] = await Promise.allSettled([
          supabase
            .from("tickers")
            .select("symbol, name, logo, asset_type")
            .in("symbol", uniqueTickers),
          fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`).then((r) =>
            r.ok ? r.json() : null
          ),
        ]);

        if (cancelled) return;

        const metaMap = {};
        if (tickerResult.status === "fulfilled" && tickerResult.value?.data) {
          for (const row of tickerResult.value.data) {
            metaMap[row.symbol] = { logo: row.logo, name: row.name, assetType: row.asset_type };
          }
        }
        setTickerMeta(metaMap);

        const quotesMap = {};
        if (quoteResult.status === "fulfilled" && quoteResult.value?.quotes) {
          Object.assign(quotesMap, quoteResult.value.quotes);
        }
        setQuotes(quotesMap);

        // Sort by market value descending, take top N (skip cash)
        const enriched = aggregated
          .filter((h) => h.asset_type !== "cash" && !h.ticker.startsWith("CUR:"))
          .map((h) => {
            const price = quotesMap[h.ticker]?.price;
            const marketValue = price != null ? h.shares * price : h.shares * h.avg_cost;
            return { ...h, marketValue };
          })
          .sort((a, b) => b.marketValue - a.marketValue)
          .slice(0, MAX_DISPLAY);

        setHoldings(enriched);
        setLoading(false);

        // Sparklines in background
        const spTickers = enriched.map((h) => h.ticker);
        if (spTickers.length > 0) {
          const endTs = Math.floor(Date.now() / 1000);
          const startTs = endTs - 30 * 24 * 60 * 60;
          const sparkResults = await Promise.allSettled(
            spTickers.map((ticker) =>
              fetch(
                `/api/market-data/historical-range?ticker=${encodeURIComponent(ticker)}&start=${startTs}&end=${endTs}&interval=1d`
              )
                .then((r) => (r.ok ? r.json() : null))
                .then((json) => ({ ticker, prices: json?.prices || [] }))
            )
          );
          if (cancelled) return;
          const spMap = {};
          for (const result of sparkResults) {
            if (result.status === "fulfilled" && result.value) {
              const { ticker, prices } = result.value;
              const series = (prices || [])
                .map((p) => Number(p?.price))
                .filter((n) => Number.isFinite(n));
              if (series.length >= 2) spMap[ticker] = series;
            }
          }
          setSparklines(spMap);
        }
      } catch (err) {
        console.error("Error loading top holdings:", err);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Don't show the card for users without investments
  if (!loading && holdings.length === 0) return null;

  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-3 w-14 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--color-border)]" />
              <div className="flex-1">
                <div className="mb-1.5 h-2.5 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
                <div className="h-2 w-1/3 animate-pulse rounded bg-[var(--color-border)]" />
              </div>
              <div className="h-2.5 w-12 animate-pulse rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="card-header">Top Holdings</h3>
        <ViewAllLink href="/investments" />
      </div>

      <div className="flex flex-col -mx-2">
        {holdings.map((h) => {
          const meta = tickerMeta[h.ticker];
          const displayName = meta?.name || h.ticker;
          const sparkData = sparklines[h.ticker];
          const quote = quotes[h.ticker];
          const price = quote?.price;
          const gainPct =
            h.avg_cost > 0 && price != null
              ? (((price - h.avg_cost) / h.avg_cost) * 100)
              : 0;

          return (
            <div
              key={h.ticker}
              className="flex items-center gap-3 py-4 px-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
            >
              <HoldingLogo
                ticker={h.ticker}
                logo={meta?.logo}
                assetType={h.asset_type}
                size={32}
              />

              <div className="min-w-0 flex-1 mr-3">
                <div className="font-medium text-[var(--color-fg)] truncate text-xs">
                  {displayName}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
                  {formatShares(h.shares)} shares
                </div>
              </div>

              <div className="hidden sm:block lg:hidden xl:block">
                <Sparkline data={sparkData} width={64} height={24} />
              </div>

              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-xs tabular-nums text-[var(--color-fg)]">
                  {formatCurrency(h.marketValue)}
                </div>
                {price != null && (
                  <div
                    className={`mt-0.5 text-[11px] font-medium tabular-nums ${gainPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {gainPct >= 0 ? "+" : ""}
                    {gainPct.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
