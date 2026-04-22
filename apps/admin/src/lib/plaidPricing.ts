/**
 * Plaid billing rates from our Master Agreement (dashboard → Contracts & Rates).
 *
 * Plaid bills per *connected account* per month for each recurring product,
 * not per item. One login to Chase that exposes 5 accounts counts as 5 for
 * every product we enable on it.
 *
 * Per-call products (Balance at $0.10/call, Auth, Identity) don't fit a
 * monthly estimate and are intentionally excluded. Balance usage shows up
 * on the invoice only when we hit /accounts/balance/get; it's not a flat
 * monthly line.
 *
 * All of these can be overridden via env vars without a code change:
 *   PLAID_PRICE_TRANSACTIONS=0.40
 *   PLAID_PRICE_RECURRING_TRANSACTIONS=0.20
 *   PLAID_PRICE_INVESTMENTS_HOLDINGS=0.22
 *   PLAID_PRICE_INVESTMENTS_TRANSACTIONS=0.40
 * If Plaid renegotiates the contract, bump whichever env var is out of
 * date — the admin rebuild picks it up.
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
  ratePerAccount: number;
  accountCount: number;
  total: number;
};

/**
 * Break an item down into the exact lines Plaid would show on an invoice
 * for that item this month. Takes account_count because billing is
 * per-account-per-month. Returns both a flat total and the per-line
 * breakdown so the drawer can show where the money goes.
 */
export function billableLinesForItem(
  item: Pick<PlaidItemRow, "products" | "recurring_ready">,
  accountCount: number,
): BillableLine[] {
  if (accountCount === 0) return [];
  const lines: BillableLine[] = [];
  const products = item.products ?? [];

  if (products.includes("transactions")) {
    lines.push({
      label: "Transactions",
      ratePerAccount: PLAID_RATES.transactions,
      accountCount,
      total: PLAID_RATES.transactions * accountCount,
    });
    if (item.recurring_ready) {
      lines.push({
        label: "Recurring Transactions",
        ratePerAccount: PLAID_RATES.recurring_transactions,
        accountCount,
        total: PLAID_RATES.recurring_transactions * accountCount,
      });
    }
  }

  if (products.includes("investments")) {
    lines.push({
      label: "Investments Holdings",
      ratePerAccount: PLAID_RATES.investments_holdings,
      accountCount,
      total: PLAID_RATES.investments_holdings * accountCount,
    });
    lines.push({
      label: "Investments Transactions",
      ratePerAccount: PLAID_RATES.investments_transactions,
      accountCount,
      total: PLAID_RATES.investments_transactions * accountCount,
    });
  }

  return lines;
}

export function estimateItemMonthlyCost(
  item: Pick<PlaidItemRow, "products" | "recurring_ready">,
  accountCount: number,
): number {
  return billableLinesForItem(item, accountCount).reduce(
    (sum, line) => sum + line.total,
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
