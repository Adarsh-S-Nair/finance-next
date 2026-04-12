/**
 * Pure transformation: Plaid investment transactions → database upsert rows.
 *
 * No IO, no globals, no side effects. Designed to be trivially unit-testable.
 *
 * Wire-shape contract with the legacy route handler:
 *   - `description` falls back to `'Investment Transaction'` if Plaid gave no name.
 *   - `amount` is coerced with `parseFloat` (Plaid typically returns number,
 *     but historically it was parsed, so we preserve the coercion).
 *   - `pending` is hard-coded to `false` — investment transactions are not pending.
 *   - `datetime` prefers `transaction_datetime` (which Plaid gives only sometimes),
 *     otherwise null. `date` passes through unchanged.
 *   - Transactions whose `account_id` is not in the map are dropped and counted.
 */

import type {
  AccountMap,
  BuildRowsResult,
  InvestmentTransactionUpsertRow,
  PlaidInvestmentTransaction,
  PlaidSecurity,
  ResolvedSecurity,
  SecuritiesMap,
} from './types';

/**
 * Build a SecuritiesMap from Plaid's raw securities list.
 *
 * Legacy quirk: Plaid returns `ticker_symbol`, but some securities (e.g. most
 * cash positions) have none. In those cases the legacy route fell back to
 * `name`. We preserve that exact fallback here so existing rows keep the
 * same `ticker` field even after the migration.
 */
export function buildSecuritiesMap(securities: PlaidSecurity[]): SecuritiesMap {
  const map: SecuritiesMap = new Map();
  for (const sec of securities) {
    const resolved: ResolvedSecurity = {
      ticker: sec.ticker_symbol || sec.name || null,
      name: sec.name ?? null,
      type: sec.type ?? null,
      subtype: sec.subtype ?? null,
    };
    map.set(sec.security_id, resolved);
  }
  return map;
}

/**
 * Coerce a quantity/price/fees-like field to a number or null. Preserves
 * the legacy `parseFloat(value)` behavior — strings are parsed, null/undefined
 * return null. Non-finite results (NaN, Infinity) return null.
 */
function coerceNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a single Plaid investment transaction to a DB upsert row. Returns null
 * if the transaction references an account not present in the map.
 */
export function mapTransactionToRow(
  tx: PlaidInvestmentTransaction,
  accountMap: AccountMap,
  securitiesMap: SecuritiesMap
): InvestmentTransactionUpsertRow | null {
  const accountUuid = accountMap[tx.account_id];
  if (!accountUuid) return null;

  const security = tx.security_id ? securitiesMap.get(tx.security_id) ?? null : null;

  return {
    account_id: accountUuid,
    plaid_transaction_id: tx.investment_transaction_id,
    description: tx.name || 'Investment Transaction',
    amount: parseFloat(String(tx.amount)),
    currency_code: tx.iso_currency_code || 'USD',
    pending: false,
    datetime: tx.transaction_datetime
      ? new Date(tx.transaction_datetime).toISOString()
      : null,
    date: tx.date ?? null,
    transaction_source: 'investments',
    investment_details: {
      security_id: tx.security_id ?? null,
      ticker: security?.ticker ?? null,
      security_name: security?.name ?? null,
      security_type: security?.type ?? null,
      security_subtype: security?.subtype ?? null,
      quantity: coerceNumber(tx.quantity),
      price: coerceNumber(tx.price),
      fees: coerceNumber(tx.fees),
      type: tx.type ?? null,
      subtype: tx.subtype ?? null,
      cancel_transaction_id: tx.cancel_transaction_id ?? null,
    },
  };
}

/**
 * Transform a batch of Plaid investment transactions into DB upsert rows,
 * dropping any whose account isn't in the map.
 */
export function buildInvestmentTransactionRows(
  transactions: PlaidInvestmentTransaction[],
  accountMap: AccountMap,
  securitiesMap: SecuritiesMap
): BuildRowsResult {
  const rows: InvestmentTransactionUpsertRow[] = [];
  let skippedCount = 0;

  for (const tx of transactions) {
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    if (row) {
      rows.push(row);
    } else {
      skippedCount++;
    }
  }

  return { rows, skippedCount };
}
