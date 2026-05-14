"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase/client";
import { useUser } from "../providers/UserProvider";
import { ViewAllLink } from "@zervo/ui";
import { formatCurrency as formatCurrencyBase } from "../../lib/formatCurrency";
import { formatShares } from "../../lib/formatShares";

const formatCurrency = (amount) => formatCurrencyBase(Number(amount || 0), true);

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

async function fetchTopHoldings(userId) {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "investment");

  if (!accounts || accounts.length === 0) {
    return { holdings: [], tickerMeta: {}, quotes: {}, sparklines: {} };
  }

  const accountIds = accounts.map((a) => a.id);

  const { data: holdingsData } = await supabase
    .from("holdings")
    .select("ticker, shares, avg_cost, asset_type")
    .in("account_id", accountIds);

  if (!holdingsData || holdingsData.length === 0) {
    return { holdings: [], tickerMeta: {}, quotes: {}, sparklines: {} };
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

  const [tickerResult, quoteResult] = await Promise.allSettled([
    supabase
      .from("tickers")
      .select("symbol, name, logo, asset_type")
      .in("symbol", uniqueTickers),
    fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`).then((r) =>
      r.ok ? r.json() : null,
    ),
  ]);

  const tickerMeta = {};
  if (tickerResult.status === "fulfilled" && tickerResult.value?.data) {
    for (const row of tickerResult.value.data) {
      tickerMeta[row.symbol] = { logo: row.logo, name: row.name, assetType: row.asset_type };
    }
  }

  const quotes = {};
  if (quoteResult.status === "fulfilled" && quoteResult.value?.quotes) {
    Object.assign(quotes, quoteResult.value.quotes);
  }

  // Sort by market value descending, take top N (skip cash)
  const enriched = aggregated
    .filter((h) => h.asset_type !== "cash" && !h.ticker.startsWith("CUR:"))
    .map((h) => {
      const price = quotes[h.ticker]?.price;
      const marketValue = price != null ? h.shares * price : h.shares * h.avg_cost;
      return { ...h, marketValue };
    })
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, MAX_DISPLAY);

  // Sparklines in parallel
  const spTickers = enriched.map((h) => h.ticker);
  const sparklines = {};
  if (spTickers.length > 0) {
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - 30 * 24 * 60 * 60;
    const sparkResults = await Promise.allSettled(
      spTickers.map((ticker) =>
        fetch(
          `/api/market-data/historical-range?ticker=${encodeURIComponent(ticker)}&start=${startTs}&end=${endTs}&interval=1d`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((json) => ({ ticker, prices: json?.prices || [] })),
      ),
    );
    for (const result of sparkResults) {
      if (result.status === "fulfilled" && result.value) {
        const { ticker, prices } = result.value;
        const series = (prices || []).map((p) => Number(p?.price)).filter((n) => Number.isFinite(n));
        if (series.length >= 2) sparklines[ticker] = series;
      }
    }
  }

  return { holdings: enriched, tickerMeta, quotes, sparklines };
}

export default function TopHoldingsCard({ mockData } = {}) {
  const { user, isPro } = useUser();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  // Top holdings is a multi-source query (Supabase + two REST
  // endpoints + sparkline fetches) so it's the prime candidate for
  // react-query caching — without this the user waits on all of
  // that every time they click back onto the dashboard.
  const { data, isLoading } = useQuery({
    queryKey: ["top-holdings", user?.id],
    queryFn: () => fetchTopHoldings(user.id),
    enabled: !mockData && !!user?.id,
  });

  const holdings = mockData?.holdings ?? data?.holdings ?? [];
  const tickerMeta = mockData?.tickerMeta ?? data?.tickerMeta ?? {};
  const quotes = mockData?.quotes ?? data?.quotes ?? {};
  const sparklines = mockData?.sparklines ?? data?.sparklines ?? {};
  const loading = mockData ? false : isLoading && !data;

  // Don't show the card for users without investments
  if (!loading && holdings.length === 0) return null;

  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-border)]" />
          <div className="h-3 w-14 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="flex items-center gap-3 py-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--color-border)]" />
          <div className="flex-1">
            <div className="mb-1.5 h-3 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-[var(--color-border)]" />
          </div>
          <div className="text-right">
            <div className="mb-1 h-3 w-14 animate-pulse rounded bg-[var(--color-border)]" />
            <div className="ml-auto h-2 w-10 animate-pulse rounded bg-[var(--color-border)]" />
          </div>
        </div>
        <div className="mt-3 h-6 w-full animate-pulse rounded bg-[var(--color-border)] opacity-40" />
      </div>
    );
  }

  // Clamp the active index if the holdings list shrinks (e.g. on refetch).
  const safeIndex = Math.min(activeIndex, holdings.length - 1);
  const current = holdings[safeIndex];
  const meta = tickerMeta[current.ticker];
  const displayName = meta?.name || current.ticker;
  const sparkData = sparklines[current.ticker];
  const quote = quotes[current.ticker];
  const price = quote?.price;
  const gainPct =
    current.avg_cost > 0 && price != null
      ? ((price - current.avg_cost) / current.avg_cost) * 100
      : 0;

  const goPrev = () => {
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + holdings.length) % holdings.length);
  };
  const goNext = () => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % holdings.length);
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="card-header">Top Holdings</h3>
        <div className="flex items-center gap-2">
          {holdings.length > 1 && (
            <div className="flex items-center gap-0.5 -mr-1">
              <button
                onClick={goPrev}
                className="w-6 h-6 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06] transition-colors"
                aria-label="Previous holding"
              >
                <span className="text-sm leading-none">&#8249;</span>
              </button>
              <button
                onClick={goNext}
                className="w-6 h-6 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06] transition-colors"
                aria-label="Next holding"
              >
                <span className="text-sm leading-none">&#8250;</span>
              </button>
            </div>
          )}
          <ViewAllLink href="/investments" />
        </div>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={current.ticker + safeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 py-2">
              <HoldingLogo
                ticker={current.ticker}
                logo={meta?.logo}
                assetType={current.asset_type}
                size={40}
              />

              <div className="min-w-0 flex-1 mr-2">
                <div className="font-medium text-[var(--color-fg)] truncate text-sm">
                  {displayName}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
                  {formatShares(current.shares)} shares
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-sm tabular-nums text-[var(--color-fg)]">
                  {formatCurrency(current.marketValue)}
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

            <div className="mt-3 flex justify-center">
              <Sparkline data={sparkData} width={260} height={40} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {holdings.length > 1 && (
        <div className="flex items-center gap-1 mt-4">
          {holdings.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] transition-all duration-500 ${
                i === safeIndex
                  ? "flex-1 bg-[var(--color-fg)]"
                  : "flex-1 bg-[var(--color-fg)]/[0.15]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
