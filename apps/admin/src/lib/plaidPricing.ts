/**
 * Plaid billing rates from our Master Agreement (dashboard → Contracts & Rates).
 *
 * Plaid bills per Item per month, not per sub-account. The contract page
 * uses the phrase "per connected account/month" but the Transactions
 * Activity Summary on the same dashboard tracks Items, not sub-accounts —
 * "connected account" in Plaid's pricing language === Item (one user's
 * connection to one institution).
 *
 * Eligibility still matters per product: an Item with only investment
 * accounts shouldn't bill for Transactions even though `products`
 * includes it, because there's nothing for sync to pull. The
 * per-product type filters mirror the ones our own sync code uses in
 * apps/finance/src/lib/plaid.
 *
 * Per-call products (Balance at $0.10/call, Auth, Identity) don't fit a
 * monthly estimate and are intentionally excluded.
 *
 * All line rates are overridable via env (no redeploy wall for rate changes):
 *   PLAID_PRICE_TRANSACTIONS
 *   PLAID_PRICE_RECURRING_TRANSACTIONS
 *   PLAID_PRICE_INVESTMENTS_HOLDINGS
 *   PLAID_PRICE_INVESTMENTS_TRANSACTIONS
 */

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const PLAID_RATES = {
  transactions: envNum("PLAID_PRICE_TRANSACTIONS", 0.3),
  recurring_transactions: envNum("PLAID_PRICE_RECURRING_TRANSACTIONS", 0.15),
  investments_holdings: envNum("PLAID_PRICE_INVESTMENTS_HOLDINGS", 0.18),
  investments_transactions: envNum("PLAID_PRICE_INVESTMENTS_TRANSACTIONS", 0.35),
} as const;

// Which Plaid account types each product is billed against. Mirrors
// apps/finance/src/lib/plaid/**: transactions sync skips non-depository/
// non-credit accounts; investment sync filters to type === 'investment'.
const TRANSACTION_ACCOUNT_TYPES = new Set(["depository", "credit"]);
const INVESTMENT_ACCOUNT_TYPES = new Set(["investment"]);

export type PlaidItemRow = {
  id: string;
  user_id: string;
  item_id: string;
  products: string[] | null;
  recurring_ready: boolean | null;
  sync_status: string | null;
  last_error: string | null;
  created_at: string | null;
};

export type BillableLine = {
  label: string;
  rate: number;
};

function hasEligible(types: (string | null)[], allowed: Set<string>): boolean {
  for (const t of types) if (t && allowed.has(t)) return true;
  return false;
}

/**
 * Break an item down into the invoice lines Plaid would bill for it this
 * month. Each line is a flat per-Item charge; the account types are only
 * used to filter out products the Item can't actually exercise (a Fidelity
 * item with only investment accounts doesn't ring up Transactions; a Chase
 * item with only credit cards doesn't ring up Investments).
 */
export function billableLinesForItem(
  item: Pick<PlaidItemRow, "products" | "recurring_ready">,
  accountTypes: (string | null)[],
): BillableLine[] {
  const lines: BillableLine[] = [];
  const products = item.products ?? [];

  if (products.includes("transactions") && hasEligible(accountTypes, TRANSACTION_ACCOUNT_TYPES)) {
    lines.push({ label: "Transactions", rate: PLAID_RATES.transactions });
    if (item.recurring_ready) {
      lines.push({
        label: "Recurring Transactions",
        rate: PLAID_RATES.recurring_transactions,
      });
    }
  }

  if (products.includes("investments") && hasEligible(accountTypes, INVESTMENT_ACCOUNT_TYPES)) {
    lines.push({ label: "Investments Holdings", rate: PLAID_RATES.investments_holdings });
    lines.push({
      label: "Investments Transactions",
      rate: PLAID_RATES.investments_transactions,
    });
  }

  return lines;
}

export function estimateItemMonthlyCost(
  item: Pick<PlaidItemRow, "products" | "recurring_ready">,
  accountTypes: (string | null)[],
): number {
  return billableLinesForItem(item, accountTypes).reduce(
    (sum, line) => sum + line.rate,
    0,
  );
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
