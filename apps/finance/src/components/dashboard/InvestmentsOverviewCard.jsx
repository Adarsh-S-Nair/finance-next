"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, ViewAllLink } from "@zervo/ui";
import { supabase } from "../../lib/supabase/client";
import { authFetch } from "../../lib/api/fetch";
import { useUser } from "../providers/UserProvider";
import { CurrencyAmount, formatCurrency } from "../../lib/formatCurrency";

const TOP_N = 5;

/**
 * Portfolio-level investments overview — the dashboard's single
 * investing surface, full width. A value-over-time line chart (same
 * source and look as the investments page) on the left, the top
 * holdings on the right: logo, name, with ticker + weight as metadata
 * and no dividers between rows.
 */
async function fetchOverview(userId) {
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

  const [tickerResult, quoteResult, seriesResult] = await Promise.allSettled([
    supabase.from("tickers").select("symbol, name, logo").in("symbol", uniqueTickers),
    fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(",")}`).then((r) =>
      r.ok ? r.json() : null,
    ),
    authFetch(`/api/investments/by-date?maxDays=365`).then((r) => (r.ok ? r.json() : null)),
  ]);

  const meta = {};
  if (tickerResult.status === "fulfilled" && tickerResult.value?.data) {
    for (const row of tickerResult.value.data) meta[row.symbol] = row;
  }
  const quotes =
    quoteResult.status === "fulfilled" && quoteResult.value?.quotes
      ? quoteResult.value.quotes
      : {};
  const series =
    seriesResult.status === "fulfilled" && seriesResult.value?.data
      ? seriesResult.value.data
      : [];

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
    series,
  };
}

function HoldingLogo({ ticker, logo }) {
  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
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
          {ticker.slice(0, 3)}
        </span>
      </div>
    </div>
  );
}

export default function InvestmentsOverviewCard({ mockData } = {}) {
  const { user } = useUser();
  const [activeIndex, setActiveIndex] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["investments-overview", user?.id],
    queryFn: () => fetchOverview(user.id),
    enabled: !mockData && !!user?.id,
  });

  const portfolio = mockData ?? data;
  const loading = mockData ? false : isLoading && !data;

  // Shape the by-date series into LineChart points; synthesize a flat
  // 2-point line if we have a live total but no snapshots yet.
  const chartData = useMemo(() => {
    const points = (portfolio?.series ?? []).map((item) => ({
      dateString: item.date,
      date: new Date(item.date),
      value: Number(item.value) || 0,
    }));
    if (points.length === 1 || (points.length === 0 && portfolio?.totalValue != null)) {
      const base =
        points[0] ?? { dateString: new Date().toISOString().slice(0, 10), date: new Date(), value: portfolio.totalValue };
      const earlier = new Date(base.date);
      earlier.setDate(earlier.getDate() - 30);
      return [{ ...base, dateString: earlier.toISOString().slice(0, 10), date: earlier }, base];
    }
    return points;
  }, [portfolio]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-6 h-3 w-28 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="h-10 w-44 animate-pulse rounded bg-[var(--color-border)] mb-2" />
            <div className="h-[170px] w-full animate-pulse rounded bg-[var(--color-border)]/40" />
          </div>
          <div className="lg:col-span-5 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-[var(--color-border)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!portfolio || portfolio.holdings.length === 0) return null;

  const { totalValue, totalReturn, totalReturnPct, holdings, moreCount } = portfolio;

  const hovered = activeIndex != null ? chartData[activeIndex] : null;
  const heroValue = hovered?.value ?? totalValue;
  const hasChart = chartData.length >= 2;
  const lineUp =
    hasChart && chartData[chartData.length - 1].value >= chartData[0].value;
  const lineColor = lineUp ? "var(--color-success)" : "var(--color-danger)";
  const up = (totalReturn ?? 0) >= 0;

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="card-header">Investments</h3>
        <ViewAllLink href="/investments" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Value over time */}
        <div className="lg:col-span-7" onMouseLeave={() => setActiveIndex(null)}>
          <div className="text-3xl sm:text-4xl font-medium tracking-tight tabular-nums text-[var(--color-fg)]">
            <CurrencyAmount amount={heroValue} />
          </div>
          {totalReturn != null && (
            <div className="mt-1 flex items-baseline gap-2 text-xs font-medium tabular-nums">
              <span className={up ? "text-emerald-500" : "text-rose-500"}>
                {up ? "▲" : "▼"} {formatCurrency(Math.abs(totalReturn))} ({up ? "+" : "−"}
                {Math.abs(totalReturnPct).toFixed(1)}%)
              </span>
              <span className="text-[var(--color-muted)]">
                {hovered
                  ? hovered.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "total return"}
              </span>
            </div>
          )}

          {hasChart && (
            <div className="mt-4" style={{ height: 180 }}>
              <LineChart
                data={chartData}
                dataKey="value"
                width="100%"
                height={180}
                margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                strokeColor={lineColor}
                strokeWidth={2}
                showArea
                areaOpacity={0.14}
                showDots={false}
                onMouseMove={(_d, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                showTooltip={false}
                gradientId="dashInvestmentsGradient"
                curveType="monotone"
                animationDuration={700}
                xAxisDataKey="dateString"
                yAxisDomain={["dataMin", "dataMax"]}
              />
            </div>
          )}
        </div>

        {/* Top holdings — logo + name, ticker/weight as metadata, no dividers */}
        <div className="lg:col-span-5">
          <div className="space-y-1">
            {holdings.map((h) => (
              <div key={h.ticker} className="flex items-center gap-3 py-1.5">
                <HoldingLogo ticker={h.ticker} logo={h.logo} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--color-fg)]">
                    {h.name}
                  </div>
                  <div className="text-[11px] tabular-nums text-[var(--color-muted)]">
                    {h.ticker} · {h.weight.toFixed(0)}% of portfolio
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm tabular-nums text-[var(--color-fg)]">
                    {formatCurrency(h.marketValue)}
                  </div>
                  {h.gainPct != null && (
                    <div
                      className={`text-[11px] font-medium tabular-nums ${
                        h.gainPct >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {h.gainPct >= 0 ? "▲" : "▼"} {Math.abs(h.gainPct).toFixed(1)}%
                    </div>
                  )}
                </div>
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
