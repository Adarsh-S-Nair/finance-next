/**
 * Maps Plaid account types to the Plaid products that account benefits from.
 *
 * Used by the exchange-token flow to derive the product list to record on
 * `plaid_items.products` and to figure out which sync runners to fire.
 *
 * Adding a new Plaid product (liabilities, identity, income, etc.) is a
 * matter of adding it to the array(s) below and registering a runner in
 * syncRunners.ts. No need to touch the exchange-token route logic.
 */
export const ACCOUNT_TYPE_PRODUCTS: Record<string, string[]> = {
  depository: ["transactions"],
  credit: ["transactions", "liabilities"], // credit cards: txns + APR/due-date data
  loan: ["liabilities"],                    // mortgage/student loans: liabilities only
  investment: ["investments"],
};

/**
 * Derive the deduped list of Plaid products implied by a set of accounts.
 * Pass the accounts you got back from `accountsGet`.
 */
export function productsForAccounts(
  accounts: Array<{ type?: string | null }>,
): string[] {
  const seen = new Set<string>();
  for (const account of accounts) {
    const products = ACCOUNT_TYPE_PRODUCTS[account.type ?? ""] ?? [];
    for (const product of products) seen.add(product);
  }
  return Array.from(seen);
}
