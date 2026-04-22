/**
 * Rough Plaid recurring-billing estimate, in USD per active item per month.
 *
 * Plaid bills per connected item (one bank login == one item) at a rate that
 * depends on which products are attached. The numbers here are mid-tier
 * ballpark rates — your real invoice depends on your Plaid contract, so the
 * admin UI labels everything "est." and treats this as guidance, not truth.
 *
 * Only recurring products are listed. Per-call products (auth, identity)
 * are billed per verification, not per item/month, so they don't belong in
 * a monthly estimate.
 *
 * Override any line via env var (no redeploy wall for rate changes):
 *   PLAID_PRICE_TRANSACTIONS=0.50
 *   PLAID_PRICE_INVESTMENTS=1.20
 *   PLAID_PRICE_LIABILITIES=0.20
 *   PLAID_PRICE_SIGNAL=0.60
 *   PLAID_PRICE_INCOME=0.60
 *   PLAID_PRICE_ASSETS=0.60
 */

const DEFAULTS: Record<string, number> = {
  transactions: 0.3,
  investments: 1.5,
  liabilities: 0.2,
  signal: 0.6,
  income: 0.6,
  assets: 0.6,
};

function envOverride(product: string): number | null {
  const key = `PLAID_PRICE_${product.toUpperCase()}`;
  const raw = process.env[key];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getProductMonthlyRate(product: string): number {
  return envOverride(product) ?? DEFAULTS[product] ?? 0;
}

export function estimateItemMonthlyCost(
  products: string[] | null | undefined,
): number {
  if (!products?.length) return 0;
  return products.reduce((sum, p) => sum + getProductMonthlyRate(p), 0);
}

export type PlaidItemRow = {
  id: string;
  user_id: string;
  item_id: string;
  products: string[] | null;
  sync_status: string | null;
  last_error: string | null;
  created_at: string | null;
};

export function estimateUserMonthlyCost(items: PlaidItemRow[]): number {
  return items.reduce((sum, it) => sum + estimateItemMonthlyCost(it.products), 0);
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
