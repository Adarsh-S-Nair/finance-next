/**
 * Types for the Plaid recurring transactions sync pipeline.
 *
 * Narrow by design: we declare only the fields we actually read from Plaid
 * or write to the `recurring_streams` table. Matches the style of the
 * sibling `transactionSync` and `investmentTransactionSync` modules.
 */

export type StreamType = 'inflow' | 'outflow';

export interface PlaidAmount {
  amount?: number | null;
  iso_currency_code?: string | null;
}

export interface PlaidPersonalFinanceCategory {
  primary?: string | null;
  detailed?: string | null;
}

export interface PlaidRecurringStream {
  account_id: string;
  stream_id: string;
  description?: string | null;
  merchant_name?: string | null;
  frequency?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  first_date?: string | null;
  last_date?: string | null;
  predicted_next_date?: string | null;
  average_amount?: PlaidAmount | null;
  last_amount?: PlaidAmount | null;
  personal_finance_category?: PlaidPersonalFinanceCategory | null;
  transaction_ids?: string[] | null;
}

/** Row written to the `recurring_streams` table. */
export interface RecurringStreamRecord {
  user_id: string;
  plaid_item_id: string;
  account_id: string;
  stream_id: string;
  stream_type: StreamType;
  description: string | null | undefined;
  merchant_name: string | null;
  frequency: string | null | undefined;
  status: string | null | undefined;
  is_active: boolean | null | undefined;
  first_date: string | null | undefined;
  last_date: string | null | undefined;
  predicted_next_date: string | null;
  average_amount: number;
  last_amount: number;
  iso_currency_code: string;
  category_primary: string | null;
  category_detailed: string | null;
  transaction_ids: string[];
  updated_at: string;
  synced_at: string;
}

/** Per-item failure captured during the per-item loop. */
export interface RecurringItemError {
  plaidItemId: string;
  error: string;
  errorCode?: string | null;
}

/**
 * The result shape returned to the HTTP caller. The legacy route had three
 * distinct early-return shapes, all represented here:
 *   1. No plaid items at all → success, message='No connected accounts', synced=0
 *   2. Some items exist but none are recurring-ready → success, message='...',
 *      synced=0, itemsNotReady=N
 *   3. Normal flow → success depends on non-consent error count
 */
export interface RecurringSyncResult {
  success: boolean;
  synced: number;
  customDetected?: number;
  itemsProcessed?: number;
  errors?: RecurringItemError[];
  itemsNeedingConsent?: string[];
  message?: string;
  itemsNotReady?: number;
}
