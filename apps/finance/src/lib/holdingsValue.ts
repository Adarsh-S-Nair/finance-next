/**
 * Shared holdings-valuation helpers.
 *
 * The investments page, the per-account detail page, the investments
 * AccountsCard, and the server-side /api/plaid/accounts route all need to
 * value an investment account the same way: by the *latest* price of its
 * holdings, not by the (often stale) cached `balances.current` that Plaid
 * last reported. Keeping the math in one place guarantees the big number,
 * the allocation card, the per-account rows, and the dashboard never drift
 * apart.
 *
 * Pricing rule per holding: live quote price when we have one, else fall
 * back to the position's average cost. Cash (asset_type 'cash' or a
 * `CUR:` ticker) is priced at $1.00 by the quotes layer, so it flows
 * through the same path.
 */

export interface HoldingLike {
  ticker?: string | null;
  shares?: number | string | null;
  avg_cost?: number | string | null;
  asset_type?: string | null;
}

export interface QuoteLike {
  price?: number | null;
}

/** A holding is "cash" if tagged as such or carries a `CUR:` ticker. */
export function isCashHolding(h: HoldingLike): boolean {
  if ((h.asset_type || "").toLowerCase() === "cash") return true;
  return (h.ticker || "").toUpperCase().startsWith("CUR:");
}

/**
 * Pull the ISO currency code out of a cash holding's ticker
 * (`CUR:USD` → `USD`). Falls back to `USD` when there's nothing to parse.
 */
export function cashCurrencyCode(h: HoldingLike): string {
  const t = (h.ticker || "").toUpperCase();
  if (t.startsWith("CUR:")) {
    const code = t.slice(4).trim();
    if (code) return code;
  }
  return "USD";
}

const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CHF: "Swiss Franc",
  CNY: "Chinese Yuan",
  INR: "Indian Rupee",
  HKD: "Hong Kong Dollar",
  SGD: "Singapore Dollar",
  MXN: "Mexican Peso",
  BRL: "Brazilian Real",
};

/**
 * Friendly display name for a cash holding (`CUR:USD` → `US Dollar`).
 * Falls back to the raw currency code for anything not in the map.
 */
export function cashCurrencyName(h: HoldingLike): string {
  const code = cashCurrencyCode(h);
  return CURRENCY_NAMES[code] || code;
}

/** Latest market value of a single holding (live price, else cost basis). */
export function holdingMarketValue(
  h: HoldingLike,
  quotes: Record<string, QuoteLike | undefined> | null | undefined,
): number {
  const shares = Number(h.shares || 0);
  const price = quotes?.[(h.ticker || "").toString()]?.price;
  if (price != null && Number.isFinite(price)) return shares * price;
  return shares * Number(h.avg_cost || 0);
}

/** Sum of latest market values across a list of holdings. */
export function sumHoldingsMarketValue(
  holdings: HoldingLike[] | null | undefined,
  quotes: Record<string, QuoteLike | undefined> | null | undefined,
): number {
  return (holdings || []).reduce(
    (sum, h) => sum + holdingMarketValue(h, quotes),
    0,
  );
}
