/**
 * Types for the Plaid investment transaction sync pipeline.
 *
 * Narrow by design: we declare only the fields we actually read from Plaid
 * or write to the DB. Matches the style of `src/lib/plaid/transactionSync/types.ts`.
 */

export interface PlaidSecurity {
  security_id: string;
  ticker_symbol?: string | null;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
}

export interface PlaidInvestmentTransaction {
  investment_transaction_id: string;
  account_id: string;
  security_id?: string | null;
  name?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  transaction_datetime?: string | null;
  date?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  fees?: number | string | null;
  type?: string | null;
  subtype?: string | null;
  cancel_transaction_id?: string | null;
}

/** Map from Plaid `account_id` → DB accounts.id (uuid). */
export type AccountMap = Record<string, string>;

export interface ResolvedSecurity {
  ticker: string | null;
  name: string | null;
  type: string | null;
  subtype: string | null;
}

/** Map from Plaid `security_id` → the subset of security fields we keep. */
export type SecuritiesMap = Map<string, ResolvedSecurity>;

/** Row written to the `transactions` table for an investment transaction. */
export interface InvestmentTransactionUpsertRow {
  account_id: string;
  plaid_transaction_id: string;
  description: string;
  amount: number;
  currency_code: string;
  pending: false;
  datetime: string | null;
  date: string | null;
  transaction_source: 'investments';
  investment_details: {
    security_id: string | null;
    ticker: string | null;
    security_name: string | null;
    security_type: string | null;
    security_subtype: string | null;
    quantity: number | null;
    price: number | null;
    fees: number | null;
    type: string | null;
    subtype: string | null;
    cancel_transaction_id: string | null;
  };
}

export interface BuildRowsResult {
  rows: InvestmentTransactionUpsertRow[];
  /** How many Plaid transactions we dropped because they referenced an
   * account not present in the account map. */
  skippedCount: number;
}

export interface InvestmentSyncResult {
  success: true;
  transactions_synced: number;
  message?: string;
}
