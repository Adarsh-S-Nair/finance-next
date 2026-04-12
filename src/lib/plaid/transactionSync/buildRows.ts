/**
 * Pure transformation: Plaid transactions → database upsert rows.
 *
 * No IO, no globals, no side effects. The only dependency is `formatInTimeZone`
 * from date-fns-tz which is itself pure. This is the kind of function that
 * should be trivial to unit test.
 */

import { formatInTimeZone } from 'date-fns-tz';
import type {
  AccountMap,
  BuildRowsResult,
  PlaidTransaction,
  TransactionUpsertRow,
} from './types';

/**
 * Target timezone for resolving "effective date" of a transaction.
 *
 * Rationale: a late-night EST transaction (e.g. 8 PM EST = 1 AM UTC next day)
 * should be recorded on the correct calendar day from the user's perspective,
 * not the UTC calendar day. This mirrors the behavior of the legacy sync route.
 *
 * TODO: make this configurable per-user once we support international users.
 */
const TARGET_TIMEZONE = 'America/New_York';

/**
 * Resolve the best-available effective date for a Plaid transaction, in the
 * target timezone.
 *
 * Precedence: authorized_datetime > datetime > authorized_date > date.
 */
export function resolveEffectiveDate(tx: PlaidTransaction): string | null {
  if (tx.authorized_datetime) {
    return formatInTimeZone(tx.authorized_datetime, TARGET_TIMEZONE, 'yyyy-MM-dd');
  }
  if (tx.datetime) {
    return formatInTimeZone(tx.datetime, TARGET_TIMEZONE, 'yyyy-MM-dd');
  }
  if (tx.authorized_date) {
    return tx.authorized_date;
  }
  return tx.date ?? null;
}

/**
 * Map a single Plaid transaction to a DB upsert row. Returns null if the
 * transaction references an account not present in the map (orphaned tx).
 */
export function mapTransactionToRow(
  tx: PlaidTransaction,
  accountMap: AccountMap
): TransactionUpsertRow | null {
  const accountUuid = accountMap[tx.account_id];
  if (!accountUuid) return null;

  const effectiveDate = resolveEffectiveDate(tx);
  const firstCounterpartyLogo =
    tx.counterparties && tx.counterparties.length > 0
      ? tx.counterparties[0]?.logo_url ?? null
      : null;

  return {
    account_id: accountUuid,
    plaid_transaction_id: tx.transaction_id,
    description: tx.name || tx.original_description || 'Unknown',
    // Plaid represents debits as positive; we store them as negative.
    amount: -Number(tx.amount),
    currency_code: tx.iso_currency_code || 'USD',
    pending: tx.pending,
    merchant_name: tx.merchant_name ?? null,
    icon_url: tx.logo_url ?? firstCounterpartyLogo,
    personal_finance_category: tx.personal_finance_category ?? null,
    datetime: tx.datetime || (effectiveDate ? new Date(effectiveDate).toISOString() : null),
    date: effectiveDate,
    authorized_date: tx.authorized_date ?? null,
    authorized_datetime: tx.authorized_datetime ?? null,
    location: tx.location ?? null,
    payment_channel: tx.payment_channel ?? null,
    website: tx.website ?? null,
    pending_plaid_transaction_id: tx.pending_transaction_id ?? null,
    category_id: null, // set later by the category-linking pass
  };
}

/**
 * Build upsert rows for an entire batch of Plaid transactions, and collect
 * pending→posted replacements that the caller needs to delete.
 *
 * A Plaid tx with `pending_transaction_id` set means "this is the posted
 * version of an earlier pending tx". The pending row in our DB must be
 * deleted before upserting the posted row to keep the ledger consistent.
 */
export function buildTransactionRows(
  plaidTransactions: PlaidTransaction[],
  accountMap: AccountMap
): BuildRowsResult {
  const rows: TransactionUpsertRow[] = [];
  const pendingReplacements: BuildRowsResult['pendingReplacements'] = [];
  let skippedCount = 0;

  for (const tx of plaidTransactions) {
    const row = mapTransactionToRow(tx, accountMap);
    if (!row) {
      skippedCount++;
      continue;
    }

    if (tx.pending_transaction_id) {
      pendingReplacements.push({
        pending_plaid_transaction_id: tx.pending_transaction_id,
        account_uuid: row.account_id,
      });
    }

    rows.push(row);
  }

  return { rows, pendingReplacements, skippedCount };
}
