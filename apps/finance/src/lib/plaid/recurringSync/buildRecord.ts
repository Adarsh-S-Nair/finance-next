/**
 * Pure transformation: Plaid recurring stream → `recurring_streams` row.
 *
 * No IO, no globals, no side effects. The one non-pure thing is the ISO
 * timestamp for `updated_at` / `synced_at`; we inject it as a parameter so
 * tests can pin the value.
 *
 * Wire-shape contract with the legacy route:
 *   - `average_amount` / `last_amount` are absolute-valued (`Math.abs`) so
 *     consumers don't have to deal with sign conventions (inflows positive
 *     by default, outflows negative in Plaid's raw data).
 *   - `iso_currency_code` falls back from `average_amount.iso_currency_code`
 *     to `'USD'` (legacy default).
 *   - `transaction_ids` defaults to `[]` when Plaid omits it.
 *   - `predicted_next_date` coerces falsy to `null`.
 */

import type {
  PlaidRecurringStream,
  RecurringStreamRecord,
  StreamType,
} from './types';

export interface BuildStreamRecordParams {
  stream: PlaidRecurringStream;
  streamType: StreamType;
  userId: string;
  plaidItemId: string;
  /** Injected ISO timestamp used for both `updated_at` and `synced_at`.
   * Defaults to `new Date().toISOString()` if not provided. */
  nowIso?: string;
}

export function buildStreamRecord({
  stream,
  streamType,
  userId,
  plaidItemId,
  nowIso = new Date().toISOString(),
}: BuildStreamRecordParams): RecurringStreamRecord {
  return {
    user_id: userId,
    plaid_item_id: plaidItemId,
    account_id: stream.account_id,
    stream_id: stream.stream_id,
    stream_type: streamType,
    description: stream.description,
    merchant_name: stream.merchant_name || null,
    frequency: stream.frequency,
    status: stream.status,
    is_active: stream.is_active,
    first_date: stream.first_date,
    last_date: stream.last_date,
    predicted_next_date: stream.predicted_next_date || null,
    average_amount: Math.abs(stream.average_amount?.amount || 0),
    last_amount: Math.abs(stream.last_amount?.amount || 0),
    iso_currency_code: stream.average_amount?.iso_currency_code || 'USD',
    category_primary: stream.personal_finance_category?.primary || null,
    category_detailed: stream.personal_finance_category?.detailed || null,
    transaction_ids: stream.transaction_ids || [],
    updated_at: nowIso,
    synced_at: nowIso,
  };
}

/**
 * Build records for both inflow and outflow streams from a single Plaid
 * `transactionsRecurringGet` response. Kept as a single helper so callers
 * don't have to know the inflow/outflow split.
 */
export function buildStreamRecords(params: {
  inflowStreams: PlaidRecurringStream[];
  outflowStreams: PlaidRecurringStream[];
  userId: string;
  plaidItemId: string;
  nowIso?: string;
}): RecurringStreamRecord[] {
  const { inflowStreams, outflowStreams, userId, plaidItemId, nowIso } = params;
  const inflowRecords = inflowStreams.map((stream) =>
    buildStreamRecord({ stream, streamType: 'inflow', userId, plaidItemId, nowIso })
  );
  const outflowRecords = outflowStreams.map((stream) =>
    buildStreamRecord({ stream, streamType: 'outflow', userId, plaidItemId, nowIso })
  );
  return [...inflowRecords, ...outflowRecords];
}
