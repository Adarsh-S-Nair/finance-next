"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase/client";
import { useUser } from "../providers/UserProvider";
import { ViewAllLink } from "@zervo/ui";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";

const TOP_N = 5;

/**
 * Portfolio-level investments overview — the dashboard's single
 * investing surface, full width. Total market value + total return
 * up front, a grayscale allocation bar (weight by holding; color is
 * reserved for sentiment elsewhere, so allocation uses an opacity
 * ramp instead of a rainbow), and the top holdings with their
 * portfolio weight and return.
 */
async function fetchPortfolio(userId) {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "investment");

  if (!accounts || accounts.length === 0) return null;
  const accountIds = accounts.map((a) => a.id);

  const { data: holdingsData } = await supabase
    .from("holdings")
    .select("ticker, shares, avg_cost, asset_type")
    .in("account_id", accountIds);

  if (!holdingsData || holdingsData.length === 0) return null;

  // Aggregate duplicate tickers across accounts into one position.
  const byTicker = new Map();
  for (const h of holdingsData) {
    const prev = byTicker.get(h.ticker);
    const shares = Number(h.shares || 0);
    const cost = Number(h.avg_cost || 0);
    if (prev) {
      const totalShares = prev.shares + shares;
      byTicker.set(h.ticker, {
        ticker: h.ticker,
        shares: totalShares,
        avg_cost:
          totalShares > 0
            ? (prev.avg_cost * prev.shares + cost * shares) / totalShares
            : 0,
        asset_type: h.asset_type || prev.asset_type,
      });
    } else {
      byTicker.set(h.ticker, { ticker: h.ticker, shares, avg_cost: cost, asset_type: h.asset_type });
    }
  }

  const aggregated = Array.from(byTicker.values()).filter(
    (h) => h.asset_type !== "cash" && !h.ticker.startsWith("CUR:"),
  );
  const uniqueTickers = aggregated.map((h) => h.ticker);
  if (uniqueTickers.length === 0) return null;

  const [tickerResult, quoteResult] = await Promise.allSettled([
    supabase.from("tickers").select("symbol, name, logo").in("symbol", uniqueTickers),
    fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`).then((r) =>
      r.ok ? r.json() : null,
    ),
  ]);

  const meta = {};
  if (tickerResult.status === "fulfilled" && tickerResult.value?.data) {
    for (const row of tickerResult.value.data) meta[row.symbol] = row;
  }
  const quotes =
    quoteResult.status === "fulfilled" && quoteResult.value?.quotes
      ? quoteResult.value.quotes
      : {};

  const enriched = aggregated.map((h) => {
    const price = quotes[h.ticker]?.price;
    const marketValue = price != null ? h.shares * price : h.shares * h.avg_cost;
    const costBasis = h.shares * h.avg_cost;
    const gainPct =
      h.avg_cost > 0 && price != null ? ((price - h.avg_cost) / h.avg_cost) * 100 : null;
    return {
      ticker: h.ticker,
      name: meta[h.ticker]?.name || h.ticker,
      logo: meta[h.ticker]?.logo || null,
      marketValue,
      costBasis,
      gainPct,
    };
  });

  const totalValue = enriched.reduce((s, h) => s + h.marketValue, 0);
  // Only positions with a real cost basis contribute to the return
  // figure, so a holding with avg_cost 0 doesn't masquerade as pure gain.
  const withCost = enriched.filter((h) => h.costBasis > 0);
  const investedValue = withCost.reduce((s, h) => s + h.marketValue, 0);
  const investedCost = withCost.reduce((s, h) => s + h.costBasis, 0);
  const totalReturn = investedCost > 0 ? investedValue - investedCost : null;
  const totalReturnPct = investedCost > 0 ? (totalReturn / investedCost) * 100 : null;

  const sorted = [...enriched].sort((a, b) => b.marketValue - a.marketValue);
  const top = sorted.slice(0, TOP_N).map((h) => ({
    ...h,
    weight: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0,
  }));

  return {
    totalValue,
    totalReturn,
    totalReturnPct,
    holdings: top,
    moreCount: Math.max(0, sorted.length - top.length),
  };
}

// Opacity ramp for the allocation bar — monochrome, so it reads as
// "proportions of one portfolio" rather than a colored category chart.
const RAMP = [0.85, 0.62, 0.45, 0.32, 0.22];

export default function InvestmentsOverviewCard({ mockData } = {}) {
  const { user } = useUser();
  const { data, isLoading } = useQuery({
    queryKey: ["investments-overview", user?.id],
    queryFn: () => fetchPortfolio(user.id),
    enabled: !mockData && !!user?.id,
  });

  const portfolio = mockData ?? data;
  const loading = mockData ? false : isLoading && !data;

  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-border)]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <div className="h-10 w-40 animate-pulse rounded bg-[var(--color-border)] mb-2" />
            <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-border)]" />
          </div>
          <div className="lg:col-span-8 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--color-border)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Hide entirely for users without investments.
  if (!portfolio || portfolio.holdings.length === 0) return null;

  const { totalValue, totalReturn, totalReturnPct, holdings, moreCount } = portfolio;
  const up = (totalReturn ?? 0) >= 0;

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="card-header">Investments</h3>
        <ViewAllLink href="/investments" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Hero: total value + return */}
        <div className="lg:col-span-4">
          <div className="text-3xl sm:text-4xl font-medium tracking-tight tabular-nums text-[var(--color-fg)]">
            <CurrencyAmount amount={totalValue} />
          </div>
          {totalReturn != null && (
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`text-sm font-semibold tabular-nums ${
                  up ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {up ? "▲" : "▼"} {formatCurrency(Math.abs(totalReturn))}
              </span>
              <span
                className={`text-xs font-medium tabular-nums ${
                  up ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {up ? "+" : "−"}
                {Math.abs(totalReturnPct).toFixed(1)}%
              </span>
              <span className="text-xs text-[var(--color-muted)]">total return</span>
            </div>
          )}

          {/* Allocation bar — grayscale ramp by weight */}
          <div className="mt-5 flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
            {holdings.map((h, i) => (
              <div
                key={h.ticker}
                style={{
                  width: `${h.weight}%`,
                  backgroundColor: "var(--color-fg)",
                  opacity: RAMP[i] ?? 0.18,
                }}
                title={`${h.ticker} ${h.weight.toFixed(0)}%`}
              />
            ))}
          </div>
        </div>

        {/* Top holdings */}
        <div className="lg:col-span-8">
          <div className="divide-y divide-[var(--color-border)]">
            {holdings.map((h) => (
              <div key={h.ticker} className="flex items-center gap-3 py-2.5">
                <span className="w-12 shrink-0 text-xs font-semibold text-[var(--color-fg)]">
                  {h.ticker}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-muted)]">
                  {h.name}
                </span>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-muted)]">
                  {h.weight.toFixed(0)}%
                </span>
                <span className="w-20 shrink-0 text-right text-sm tabular-nums text-[var(--color-fg)]">
                  {formatCurrency(h.marketValue)}
                </span>
                <span
                  className={`w-16 shrink-0 text-right text-[11px] font-medium tabular-nums ${
                    h.gainPct == null
                      ? "text-[var(--color-muted)]"
                      : h.gainPct >= 0
                        ? "text-emerald-500"
                        : "text-rose-500"
                  }`}
                >
                  {h.gainPct == null
                    ? "—"
                    : `${h.gainPct >= 0 ? "▲" : "▼"} ${Math.abs(h.gainPct).toFixed(1)}%`}
                </span>
              </div>
            ))}
          </div>
          {moreCount > 0 && (
            <div className="pt-2 text-[11px] text-[var(--color-muted)]">
              + {moreCount} more {moreCount === 1 ? "holding" : "holdings"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
