/**
 * Plaid billing rates from our Master Agreement (dashboard → Contracts & Rates).
 *
 * Plaid bills per connected account per month, where "connected account"
 * means an account Plaid can actually operate the product on. A credit
 * card doesn't get billed for Investments Holdings; a 401k doesn't get
 * billed for Transactions. The per-product eligibility below mirrors the
 * filters our own sync code already uses in apps/finance/src/lib/plaid.
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
  ratePerAccount: number;
  accountCount: number;
  total: number;
};

function countEligible(types: (string | null)[], allowed: Set<string>): number {
  let n = 0;
  for (const t of types) if (t && allowed.has(t)) n += 1;
  return n;
}

/**
 * Break an item down into the exact invoice lines Plaid would bill for it
 * this month. Takes the account *types* (not just a count) because billing
 * filters by type per product — a Fidelity item with 5 investment accounts
 * shouldn't ring up Transactions charges, and a Chase item with 4 credit
 * cards + 1 checking shouldn't ring up Investments charges.
 */
export function billableLinesForItem(
  item: Pick<PlaidItemRow, "products" | "recurring_ready">,
  accountTypes: (string | null)[],
): BillableLine[] {
  const lines: BillableLine[] = [];
  const products = item.products ?? [];

  if (products.includes("transactions")) {
    const count = countEligible(accountTypes, TRANSACTION_ACCOUNT_TYPES);
    if (count > 0) {
      lines.push({
        label: "Transactions",
        ratePerAccount: PLAID_RATES.transactions,
        accountCount: count,
        total: PLAID_RATES.transactions * count,
      });
      if (item.recurring_ready) {
        lines.push({
          label: "Recurring Transactions",
          ratePerAccount: PLAID_RATES.recurring_transactions,
          accountCount: count,
          total: PLAID_RATES.recurring_transactions * count,
        });
      }
    }
  }

  if (products.includes("investments")) {
    const count = countEligible(accountTypes, INVESTMENT_ACCOUNT_TYPES);
    if (count > 0) {
      lines.push({
        label: "Investments Holdings",
        ratePerAccount: PLAID_RATES.investments_holdings,
        accountCount: count,
        total: PLAID_RATES.investments_holdings * count,
      });
      lines.push({
        label: "Investments Transactions",
        ratePerAccount: PLAID_RATES.investments_transactions,
        accountCount: count,
        total: PLAID_RATES.investments_transactions * count,
      });
    }
  }

  return lines;
}

export function estimateItemMonthlyCost(
  item: Pick<PlaidItemRow, "products" | "recurring_ready">,
  accountTypes: (string | null)[],
): number {
  return billableLinesForItem(item, accountTypes).reduce(
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
