import { NextResponse } from "next/server";

/**
 * GET /api/v1/trades — see lib/api-registry.ts for the canonical spec.
 *
 * Currently returns a hand-coded sample dataset so consumers can wire
 * against the schema before the ingestion pipeline lands. The shape is
 * final; only the source of the rows changes when we swap this for a
 * Supabase query.
 *
 * Public, no auth. CORS open.
 */

type Trade = {
  id: string;
  disclosed_at: string;
  transacted_at: string;
  politician: {
    id: string;
    name: string;
    chamber: "house" | "senate";
    party: "D" | "R" | "I";
    state: string;
  };
  asset: {
    ticker: string;
    name: string;
    type: "stock" | "etf" | "bond" | "option" | "crypto";
  };
  transaction_type: "buy" | "sell" | "exchange";
  amount_range: { min: number; max: number };
  source_url: string;
};

const MOCK_TRADES: Trade[] = [
  {
    id: "trd_01hxr3y6mqe9j7v4ng7t2k3p1a",
    disclosed_at: "2026-05-14",
    transacted_at: "2026-05-02",
    politician: { id: "pelosi-nancy", name: "Nancy Pelosi", chamber: "house", party: "D", state: "CA" },
    asset: { ticker: "NVDA", name: "NVIDIA Corp", type: "stock" },
    transaction_type: "buy",
    amount_range: { min: 1000000, max: 5000000 },
    source_url: "https://disclosures-clerk.house.gov/",
  },
  {
    id: "trd_01hxr3y8b2a5h9k4nm2t7v1q3c",
    disclosed_at: "2026-05-13",
    transacted_at: "2026-04-28",
    politician: { id: "tuberville-tommy", name: "Tommy Tuberville", chamber: "senate", party: "R", state: "AL" },
    asset: { ticker: "AAPL", name: "Apple Inc", type: "stock" },
    transaction_type: "sell",
    amount_range: { min: 50000, max: 100000 },
    source_url: "https://efdsearch.senate.gov/",
  },
  {
    id: "trd_01hxr3yawd9n6p3kx5q8r2v4d7",
    disclosed_at: "2026-05-12",
    transacted_at: "2026-04-30",
    politician: { id: "crenshaw-dan", name: "Dan Crenshaw", chamber: "house", party: "R", state: "TX" },
    asset: { ticker: "MSFT", name: "Microsoft Corp", type: "stock" },
    transaction_type: "buy",
    amount_range: { min: 15000, max: 50000 },
    source_url: "https://disclosures-clerk.house.gov/",
  },
  {
    id: "trd_01hxr3ycp7q4m6v2hk9j5n8t1e",
    disclosed_at: "2026-05-10",
    transacted_at: "2026-04-22",
    politician: { id: "greene-marjorie-taylor", name: "Marjorie Taylor Greene", chamber: "house", party: "R", state: "GA" },
    asset: { ticker: "TSLA", name: "Tesla Inc", type: "stock" },
    transaction_type: "buy",
    amount_range: { min: 15000, max: 50000 },
    source_url: "https://disclosures-clerk.house.gov/",
  },
  {
    id: "trd_01hxr3ye4r2t8n5kx7m1p9v3f6",
    disclosed_at: "2026-05-09",
    transacted_at: "2026-04-20",
    politician: { id: "khanna-ro", name: "Ro Khanna", chamber: "house", party: "D", state: "CA" },
    asset: { ticker: "GOOGL", name: "Alphabet Inc", type: "stock" },
    transaction_type: "sell",
    amount_range: { min: 50000, max: 100000 },
    source_url: "https://disclosures-clerk.house.gov/",
  },
  {
    id: "trd_01hxr3yg9k6h2v4mn8t3p7q1r5",
    disclosed_at: "2026-05-07",
    transacted_at: "2026-04-25",
    politician: { id: "pelosi-nancy", name: "Nancy Pelosi", chamber: "house", party: "D", state: "CA" },
    asset: { ticker: "VOO", name: "Vanguard S&P 500 ETF", type: "etf" },
    transaction_type: "buy",
    amount_range: { min: 250000, max: 500000 },
    source_url: "https://disclosures-clerk.house.gov/",
  },
  {
    id: "trd_01hxr3yh8p3m1v6kn4t9q7r2s8",
    disclosed_at: "2026-05-05",
    transacted_at: "2026-04-15",
    politician: { id: "tuberville-tommy", name: "Tommy Tuberville", chamber: "senate", party: "R", state: "AL" },
    asset: { ticker: "JPM", name: "JPMorgan Chase & Co", type: "stock" },
    transaction_type: "buy",
    amount_range: { min: 100000, max: 250000 },
    source_url: "https://efdsearch.senate.gov/",
  },
];

function parseLimit(raw: string | null): number {
  if (!raw) return 25;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(n, 100);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const ticker = url.searchParams.get("ticker")?.toUpperCase();
  const politician = url.searchParams.get("politician");
  const chamber = url.searchParams.get("chamber")?.toLowerCase();
  const since = url.searchParams.get("since");

  let filtered = MOCK_TRADES;
  if (ticker) filtered = filtered.filter((t) => t.asset.ticker === ticker);
  if (politician) filtered = filtered.filter((t) => t.politician.id === politician);
  if (chamber === "house" || chamber === "senate") {
    filtered = filtered.filter((t) => t.politician.chamber === chamber);
  }
  if (since) filtered = filtered.filter((t) => t.disclosed_at >= since);

  const page = filtered.slice(0, limit);

  return NextResponse.json(
    { data: page, has_more: filtered.length > limit },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
