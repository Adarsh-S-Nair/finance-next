/**
 * Types for the Plaid transaction sync pipeline.
 *
 * These are intentionally narrow — they describe only the fields we
 * actually read or write. We don't use the `plaid` package's generated
 * types because they're broad and pull in unused surface area.
 */

export interface PlaidPersonalFinanceCategory {
  primary: string;
  detailed: string;
  confidence_level?: string | null;
}

export interface PlaidCounterparty {
  logo_url?: string | null;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  name?: string | null;
  original_description?: string | null;
  merchant_name?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  pending: boolean;
  pending_transaction_id?: string | null;
  logo_url?: string | null;
  counterparties?: PlaidCounterparty[] | null;
  personal_finance_category?: PlaidPersonalFinanceCategory | null;
  date?: string | null;
  datetime?: string | null;
  authorized_date?: string | null;
  authorized_datetime?: string | null;
  location?: Record<string, unknown> | null;
  payment_channel?: string | null;
  website?: string | null;
}

export interface PlaidAccountBalance {
  available?: number | null;
  current?: number | null;
  limit?: number | null;
  iso_currency_code?: string | null;
}

export interface PlaidAccount {
  account_id: string;
  balances?: PlaidAccountBalance | null;
}

/**
 * Row written to the `transactions` table.
 * category_id is assigned by the category-linking pass after build.
 *
 * NOTE on `undefined` vs `null`: supabase-js drops `undefined` keys during
 * JSON serialization, which means an upsert-on-conflict omits those columns
 * from the UPDATE SET clause, preserving the existing DB value. `null`
 * explicitly overwrites. For fields that Plaid may stop returning on a
 * subsequent sync (merchant_name, location, etc.) we pass through whatever
 * Plaid gave us rather than coercing to null — matching legacy behavior.
 */
export interface TransactionUpsertRow {
  account_id: string; // DB uuid
  plaid_transaction_id: string;
  description: string;
  amount: number;
  currency_code: string;
  pending: boolean;
  // Pass-through fields: leave undefined if Plaid didn't provide them.
  merchant_name: string | null | undefined;
  personal_finance_category: PlaidPersonalFinanceCategory | null | undefined;
  location: Record<string, unknown> | null | undefined;
  payment_channel: string | null | undefined;
  website: string | null | undefined;
  pending_plaid_transaction_id: string | null | undefined;
  // Fields where legacy code explicitly fell back to null.
  icon_url: string | null;
  datetime: string | null;
  date: string | null;
  authorized_date: string | null;
  authorized_datetime: string | null;
  category_id: string | null;
}

export interface PendingReplacement {
  pending_plaid_transaction_id: string;
  account_uuid: string;
}

export interface BuildRowsResult {
  rows: TransactionUpsertRow[];
  pendingReplacements: PendingReplacement[];
  skippedCount: number;
}

/** Map from Plaid `account_id` → DB accounts.id (uuid). */
export type AccountMap = Record<string, string>;

export interface CategoryGroupRow {
  id: string;
  name: string;
}

export interface SystemCategoryRow {
  id: string;
  label: string;
  plaid_category_key?: string | null;
}

export interface SyncResult {
  success: true;
  message?: string;
  transactions_synced: number;
  pending_transactions_updated: number;
  // Absent on the "already syncing" short-circuit to match legacy wire shape.
  accounts_updated?: number;
  snapshots_created?: number;
  cursor: string | null;
}
