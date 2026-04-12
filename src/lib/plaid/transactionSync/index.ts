/**
 * Transaction sync orchestrator.
 *
 * This is the single entry point the `/api/plaid/transactions/sync` route
 * calls. It's where IO happens — database reads/writes, Plaid API calls,
 * and cross-module side effects. The pure planning/transformation logic
 * lives in sibling modules (buildRows, categories) and is tested in
 * isolation.
 *
 * Pattern: routes are thin (parse + dispatch + format response). Business
 * logic lives here. See `docs/architectural_patterns.md`.
 */

import {
  getAccounts,
  getTransactions,
  syncTransactions,
  PLAID_ENV,
} from '../client';
import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
import {
  generateUniqueCategoryColor,
  getNewSystemCategories,
} from '../../categoryUtils';
import { createAccountSnapshotConditional } from '../../accountSnapshotUtils';
import { fetchUserRules, applyRulesToTransactions } from '../../category-rules';
import { detectUnmatchedTransfers } from '../../transfer-detection';

import { buildTransactionRows } from './buildRows';
import {
  computeBackfillPlan,
  computeMissingCategoryGroupNames,
  extractPrimaryCategoryNames,
  getDefaultIconForGroup,
  linkRowsToCategories,
} from './categories';
import type {
  AccountMap,
  CategoryGroupRow,
  PlaidAccount,
  PlaidTransaction,
  SyncResult,
  SystemCategoryRow,
  TransactionUpsertRow,
} from './types';

const logger = createLogger('transaction-sync');

// Hard cap on total transactions fetched per sync to prevent runaway loops.
const MAX_TRANSACTIONS_PER_SYNC = 10_000;

// Number of days of history to fetch in sandbox (matches legacy behavior).
const SANDBOX_LOOKBACK_DAYS = 30;

export interface SyncParams {
  plaidItemId: string;
  userId: string;
  forceSync?: boolean;
}

/**
 * Sync transactions for a single Plaid item end-to-end.
 *
 * Contract: on any thrown error, the plaid_items row for `plaidItemId` is
 * updated to `sync_status='error'` with `last_error` set before the error
 * propagates. On success, status is set to 'idle'.
 */
export async function syncTransactionsForItem(params: SyncParams): Promise<SyncResult> {
  const { plaidItemId, userId, forceSync = false } = params;

  logger.info('Transaction sync request received', { plaidItemId, userId, forceSync });

  try {
    const plaidItem = await loadPlaidItem(plaidItemId, userId);

    if (plaidItem.sync_status === 'syncing' && !forceSync) {
      logger.info('Item is already syncing, skipping', { plaidItemId });
      // Match legacy wire shape exactly — no accounts_updated/snapshots_created.
      return {
        success: true,
        message: 'Item is already syncing',
        transactions_synced: 0,
        pending_transactions_updated: 0,
        cursor: plaidItem.transaction_cursor,
      };
    }

    await markPlaidItemStatus(plaidItemId, { sync_status: 'syncing', last_error: null });

    // --- Fetch from Plaid ---
    const { transactions: rawTransactions, nextCursor } = await fetchFromPlaid(plaidItem);

    // Production: also fetch fresh account balances in the same pass.
    const plaidAccounts: PlaidAccount[] =
      PLAID_ENV === 'sandbox' ? [] : await fetchAccountsSafe(plaidItem.access_token);

    // --- Build row plan (pure) ---
    const accountMap = await loadAccountMap(plaidItemId);
    const { rows, pendingReplacements } = buildTransactionRows(rawTransactions, accountMap);

    // --- Delete pending transactions that have just been posted ---
    await deletePendingReplacements(pendingReplacements);

    // --- Ensure category groups + system categories exist ---
    if (rows.length > 0) {
      await ensureCategoryGroups(rows);
      const allGroups = await fetchAllCategoryGroups();
      await ensureSystemCategories(rows, allGroups);
      await backfillPlaidCategoryKeys(rows, allGroups);
    }

    // --- Link rows to system category ids (pure) ---
    if (rows.length > 0) {
      const systemCategories = await fetchAllSystemCategories();
      const linked = linkRowsToCategories(rows, systemCategories);
      logger.info('Linked transactions to system categories', { linked, total: rows.length });

      // --- Apply user rules (rules may override the system-category link) ---
      try {
        const userRules = await fetchUserRules(userId);
        if (userRules.length > 0) {
          const count = applyRulesToTransactions(rows, userRules);
          logger.info('Applied user category rules', { count });
        }
      } catch (ruleError) {
        // Never fail sync on rule errors — same as legacy behavior.
        logger.error('Error applying category rules', ruleError as Error);
      }
    }

    // --- Upsert transactions ---
    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' });
      if (error) {
        throw new Error(`Failed to upsert transactions: ${error.message}`);
      }
      logger.info('Transactions upserted', { count: rows.length });
    }

    // --- Update account balances + snapshots ---
    const { updatedAccountsCount, snapshotsCreatedCount } = await updateAccountBalances(
      plaidAccounts,
      accountMap
    );

    // --- Mark item idle + advance cursor (production only) ---
    const itemUpdate: Record<string, unknown> = {
      last_transaction_sync: new Date().toISOString(),
      sync_status: 'idle',
      last_error: null,
    };
    if (PLAID_ENV !== 'sandbox') {
      itemUpdate.transaction_cursor = nextCursor;
    }
    const { error: finalUpdateError } = await supabaseAdmin
      .from('plaid_items')
      .update(itemUpdate)
      .eq('id', plaidItemId);
    if (finalUpdateError) {
      throw new Error(`Failed to update plaid item: ${finalUpdateError.message}`);
    }

    // --- Run unmatched transfer detection (best-effort) ---
    if (rows.length > 0) {
      await runTransferDetectionSafe(userId, rows);
    }

    logger.info('Transaction sync completed', {
      transactions_synced: rows.length,
      pending_transactions_updated: pendingReplacements.length,
      accounts_updated: updatedAccountsCount,
      snapshots_created: snapshotsCreatedCount,
    });
    await logger.flush();

    return {
      success: true,
      transactions_synced: rows.length,
      pending_transactions_updated: pendingReplacements.length,
      accounts_updated: updatedAccountsCount,
      snapshots_created: snapshotsCreatedCount,
      cursor: PLAID_ENV === 'sandbox' ? null : nextCursor,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Error syncing transactions', err, {
      plaidItemId,
      errorMessage: err.message,
    });
    await logger.flush();

    // Best-effort: stamp error status on the plaid item.
    try {
      await supabaseAdmin
        .from('plaid_items')
        .update({ sync_status: 'error', last_error: err.message })
        .eq('id', plaidItemId);
    } catch (statusUpdateError) {
      logger.error('Failed to write error status to plaid item', statusUpdateError as Error);
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// IO helpers — each one is small and has a single responsibility.
// These are private to the module; the orchestrator above is the public API.
// ---------------------------------------------------------------------------

interface PlaidItemRow {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
  transaction_cursor: string | null;
  sync_status: string | null;
  last_error: string | null;
}

async function loadPlaidItem(plaidItemId: string, userId: string): Promise<PlaidItemRow> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('id', plaidItemId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    logger.error('Plaid item not found', null, { plaidItemId, userId });
    throw Object.assign(new Error('Plaid item not found'), { httpStatus: 404 });
  }
  return data as PlaidItemRow;
}

async function markPlaidItemStatus(
  plaidItemId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from('plaid_items').update(patch).eq('id', plaidItemId);
}

/**
 * Fetch transactions from Plaid. Sandbox uses the legacy /transactions/get
 * endpoint with a fixed lookback window; production uses /transactions/sync
 * with cursor-based pagination.
 */
async function fetchFromPlaid(
  plaidItem: PlaidItemRow
): Promise<{ transactions: PlaidTransaction[]; nextCursor: string | null }> {
  if (PLAID_ENV === 'sandbox') {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - SANDBOX_LOOKBACK_DAYS);

    try {
      const res = await getTransactions(
        plaidItem.access_token,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      return { transactions: (res.transactions ?? []) as unknown as PlaidTransaction[], nextCursor: null };
    } catch (error) {
      const e = error as { response?: { data?: { error_message?: string } }; message?: string };
      throw new Error(`Plaid API error: ${e.response?.data?.error_message ?? e.message}`);
    }
  }

  // Production: cursor-based pagination.
  let cursor: string | null = plaidItem.transaction_cursor ?? null;
  let hasMore = true;
  const collected: PlaidTransaction[] = [];

  while (hasMore) {
    try {
      const res = await syncTransactions(plaidItem.access_token, cursor);
      const added = (res.added ?? []) as unknown as PlaidTransaction[];
      const modified = (res.modified ?? []) as unknown as PlaidTransaction[];
      collected.push(...added, ...modified);
      cursor = res.next_cursor ?? null;
      hasMore = Boolean(res.has_more);

      if (collected.length > MAX_TRANSACTIONS_PER_SYNC) {
        logger.warn('Hit MAX_TRANSACTIONS_PER_SYNC, stopping pagination', {
          count: collected.length,
        });
        break;
      }
    } catch (error) {
      const e = error as { response?: { data?: { error_message?: string } }; message?: string };
      throw new Error(`Plaid API error: ${e.response?.data?.error_message ?? e.message}`);
    }
  }

  return { transactions: collected, nextCursor: cursor };
}

async function fetchAccountsSafe(accessToken: string): Promise<PlaidAccount[]> {
  try {
    const res = await getAccounts(accessToken);
    return (res.accounts ?? []) as unknown as PlaidAccount[];
  } catch (error) {
    logger.error('Failed to fetch accounts for balance update', error as Error);
    return [];
  }
}

async function loadAccountMap(plaidItemId: string): Promise<AccountMap> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, account_id')
    .eq('plaid_item_id', plaidItemId);
  if (error) throw new Error('Failed to fetch accounts');

  const map: AccountMap = {};
  for (const row of data as Array<{ id: string; account_id: string }>) {
    map[row.account_id] = row.id;
  }
  return map;
}

async function deletePendingReplacements(
  replacements: { pending_plaid_transaction_id: string; account_uuid: string }[]
): Promise<void> {
  // Kept as a simple loop to match legacy semantics. Could be batched later.
  for (const r of replacements) {
    await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('pending_plaid_transaction_id', r.pending_plaid_transaction_id)
      .eq('account_id', r.account_uuid);
  }
}

async function ensureCategoryGroups(rows: TransactionUpsertRow[]): Promise<void> {
  const wanted = extractPrimaryCategoryNames(rows);
  if (wanted.size === 0) return;

  const { data: existing, error } = await supabaseAdmin
    .from('category_groups')
    .select('name, hex_color');
  if (error) throw new Error(`Failed to fetch existing category groups: ${error.message}`);

  const existingGroups = (existing ?? []) as Array<{ name: string; hex_color: string }>;
  const missingNames = computeMissingCategoryGroupNames(wanted, existingGroups);
  if (missingNames.length === 0) return;

  // Colors must be unique; take the running list of used colors as we go.
  const usedColors = existingGroups.map((g) => g.hex_color);

  for (const name of missingNames) {
    const color = generateUniqueCategoryColor(usedColors);
    usedColors.push(color);
    const icons = getDefaultIconForGroup(name);
    const { error: insertError } = await supabaseAdmin
      .from('category_groups')
      .insert({ name, hex_color: color, ...icons });
    if (insertError) {
      // 23505 = duplicate key. Ignore — another worker raced us here and won.
      // The case-insensitive unique index on lower(name) means we can't use
      // bulk upsert with onConflict, so we serialize inserts and swallow dups.
      if (insertError.code !== '23505') {
        throw new Error(`Failed to insert category group: ${insertError.message}`);
      }
    }
  }
}

async function fetchAllCategoryGroups(): Promise<CategoryGroupRow[]> {
  const { data, error } = await supabaseAdmin.from('category_groups').select('id, name');
  if (error) throw new Error(`Failed to fetch all category groups: ${error.message}`);
  return (data ?? []) as CategoryGroupRow[];
}

async function ensureSystemCategories(
  rows: TransactionUpsertRow[],
  allGroups: CategoryGroupRow[]
): Promise<void> {
  const { data: existing, error } = await supabaseAdmin
    .from('system_categories')
    .select('label');
  if (error) throw new Error(`Failed to fetch existing system categories: ${error.message}`);

  const existingLabels = ((existing ?? []) as Array<{ label: string }>).map((c) => c.label);

  // getNewSystemCategories is the legacy pure helper in categoryUtils.js —
  // keep using it rather than reimplementing the PFC → label mapping here.
  const newSystemCategories = getNewSystemCategories(rows, existingLabels, allGroups);

  if (newSystemCategories.length === 0) return;

  const { error: upsertError } = await supabaseAdmin
    .from('system_categories')
    .upsert(newSystemCategories, { onConflict: 'label,group_id', ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`Failed to insert system categories: ${upsertError.message}`);
  }
}

async function backfillPlaidCategoryKeys(
  rows: TransactionUpsertRow[],
  allGroups: CategoryGroupRow[]
): Promise<void> {
  const { data: missing } = await supabaseAdmin
    .from('system_categories')
    .select('id, label, group_id')
    .is('plaid_category_key', null);

  const categoriesMissingKey = (missing ?? []) as Array<{
    id: string;
    label: string;
    group_id: string;
  }>;
  if (categoriesMissingKey.length === 0) return;

  const plan = computeBackfillPlan(rows, allGroups, categoriesMissingKey);
  for (const item of plan) {
    const { error } = await supabaseAdmin
      .from('system_categories')
      .update({ plaid_category_key: item.plaid_category_key })
      .eq('id', item.systemCategoryId);
    if (error) {
      logger.warn('Failed to backfill plaid_category_key', { error, item });
    }
  }
}

async function fetchAllSystemCategories(): Promise<SystemCategoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from('system_categories')
    .select('id, label, plaid_category_key');
  if (error) throw new Error(`Failed to fetch system categories: ${error.message}`);
  return (data ?? []) as SystemCategoryRow[];
}

async function updateAccountBalances(
  plaidAccounts: PlaidAccount[],
  accountMap: AccountMap
): Promise<{ updatedAccountsCount: number; snapshotsCreatedCount: number }> {
  if (plaidAccounts.length === 0) {
    return { updatedAccountsCount: 0, snapshotsCreatedCount: 0 };
  }

  let updatedAccountsCount = 0;
  let snapshotsCreatedCount = 0;

  for (const plaidAccount of plaidAccounts) {
    const dbAccountId = accountMap[plaidAccount.account_id];
    if (!dbAccountId || !plaidAccount.balances) continue;

    const { error: updateError } = await supabaseAdmin
      .from('accounts')
      .update({ balances: plaidAccount.balances, updated_at: new Date().toISOString() })
      .eq('id', dbAccountId);

    if (updateError) {
      logger.error('Failed to update account balance', null, {
        account_id: plaidAccount.account_id,
        error: updateError,
      });
      continue;
    }

    updatedAccountsCount++;

    try {
      const snapshotResult = (await createAccountSnapshotConditional(
        plaidAccount,
        dbAccountId
      )) as { success?: boolean; skipped?: boolean; reason?: string } | undefined;
      if (snapshotResult?.success && !snapshotResult.skipped) {
        snapshotsCreatedCount++;
      }
    } catch (snapshotError) {
      logger.warn('Error creating account snapshot', {
        account_id: plaidAccount.account_id,
        error: (snapshotError as Error).message,
      });
    }
  }

  return { updatedAccountsCount, snapshotsCreatedCount };
}

async function runTransferDetectionSafe(
  userId: string,
  rows: TransactionUpsertRow[]
): Promise<void> {
  try {
    const dates = rows
      .map((r) => r.date)
      .filter((d): d is string => Boolean(d))
      .sort();
    if (dates.length === 0) return;
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    await detectUnmatchedTransfers(userId, minDate, maxDate);
  } catch (err) {
    logger.error('Error running unmatched transfer detection', err as Error);
  }
}

