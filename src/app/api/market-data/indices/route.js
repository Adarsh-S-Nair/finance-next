/**
 * Market Indices API - Fetches major index data with sparkline points
 *
 * GET /api/market-data/indices
 *
 * Returns S&P 500, Dow Jones, and VIX with current price, daily change,
 * and ~24 hourly data points for sparkline charts.
 * Uses in-memory cache with 5-minute TTL.
 */

import { NextResponse } from "next/server";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;

const INDICES = [
  { symbol: "^GSPC", name: "S&P 500", shortName: "S&P" },
  { symbol: "^DJI", name: "Dow Jones", shortName: "DOW" },
  { symbol: "^VIX", name: "VIX Index", shortName: "VIX" },
];

async function fetchIndex(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1h`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const quotes = result.indicators?.quote?.[0];
  if (!quotes?.close) return null;

  // Get close prices, filter out nulls
  const closes = quotes.close.filter((v) => v != null);
  if (closes.length === 0) return null;

  const price = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose || closes[0];
  const change = price - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;

  // Take last 24 points for sparkline
  const sparkline = closes.slice(-24);

  return {
    price,
    change,
    changePercent,
    sparkline,
  };
}

export async function GET() {
  try {
    // Return cached if fresh
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(cached);
    }

    const results = await Promise.all(
      INDICES.map(async (idx) => {
        const data = await fetchIndex(idx.symbol);
        if (!data) {
          return { ...idx, price: 0, change: 0, changePercent: 0, sparkline: [] };
        }
        return { ...idx, ...data };
      })
    );

    cached = results;
    cachedAt = Date.now();

    return NextResponse.json(results);
  } catch (error) {
    console.error("[market-indices] fetch error:", error);
    // Return stale cache if available
    if (cached) return NextResponse.json(cached);
    return NextResponse.json([], { status: 500 });
  }
}
