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
import { decryptPlaidToken } from '../../crypto/plaidTokens';

import { buildTransactionRows } from './buildRows';
import {
  computeBackfillPlan,
  computeMissingCategoryGroupNames,
  extractPrimaryCategoryNames,
  getDefaultIconForGroup,
  linkRowsToCategories,
} from './categories';
import { isCheckpointChange, projectCurrent } from './projectBalance';
import type {
  AccountMap,
  CategoryGroupRow,
  PlaidAccount,
  PlaidTransaction,
  SyncResult,
  SystemCategoryRow,
  TransactionUpsertRow,
} from './types';
import type { TablesInsert, TablesUpdate } from '../../../types/database';

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
    const {
      transactions: rawTransactions,
      removedTransactionIds,
      nextCursor,
    } = await fetchFromPlaid(plaidItem);

    // Production: also fetch fresh account balances in the same pass.
    // plaidItem.access_token is encrypted at rest; decrypt for the outbound
    // Plaid API call.
    const plaidAccounts: PlaidAccount[] =
      PLAID_ENV === 'sandbox'
        ? []
        : await fetchAccountsSafe(decryptPlaidToken(plaidItem.access_token));

    // --- Build row plan (pure) ---
    const accountMap = await loadAccountMap(plaidItemId);
    const { rows, pendingReplacements } = buildTransactionRows(rawTransactions, accountMap);

    // --- Delete pending transactions that have just been posted ---
    await deletePendingReplacements(pendingReplacements);

    // --- Delete transactions Plaid removed (cancelled holds, corrections) ---
    // We project pending transactions onto the displayed balance, so a
    // pending hold that gets released has to actually leave the DB or
    // it'll project against the balance forever.
    const removedCount = await deleteRemovedTransactions(removedTransactionIds);
    if (removedCount > 0) {
      logger.info('Deleted transactions removed by Plaid', { removedCount });
    }

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
          const count = applyRulesToTransactions(
            rows as unknown as Parameters<typeof applyRulesToTransactions>[0],
            userRules
          );
          logger.info('Applied user category rules', { count });
        }
      } catch (ruleError) {
        // Never fail sync on rule errors — same as legacy behavior.
        logger.error('Error applying category rules', ruleError as Error);
      }
    }

    // --- Preserve user-chosen categories ---
    // Any existing row the user has manually categorised
    // (is_user_categorized = true) must keep its category_id, regardless
    // of what Plaid returned or what the rule engine produced above. We
    // overwrite the batch row's category_id with the DB value right
    // before the upsert so the ON CONFLICT UPDATE doesn't clobber it.
    if (rows.length > 0) {
      const preservedCount = await preserveUserCategories(rows);
      if (preservedCount > 0) {
        logger.info('Preserved user-chosen categories across sync', {
          preserved: preservedCount,
        });
      }
    }

    // --- Upsert transactions ---
    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('transactions')
        .upsert(rows as TablesInsert<'transactions'>[], {
          onConflict: 'plaid_transaction_id',
        });
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
      .update(itemUpdate as TablesUpdate<'plaid_items'>)
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
  await supabaseAdmin
    .from('plaid_items')
    .update(patch as TablesUpdate<'plaid_items'>)
    .eq('id', plaidItemId);
}

/**
 * Fetch transactions from Plaid. Sandbox uses the legacy /transactions/get
 * endpoint with a fixed lookback window; production uses /transactions/sync
 * with cursor-based pagination.
 *
 * The sync endpoint returns three buckets — `added`, `modified`, `removed`.
 * `added` + `modified` flow into the upsert pipeline as-is. `removed`
 * carries `transaction_id`s that Plaid no longer considers valid (cancelled
 * pending holds, duplicates, corrections); we surface those so the
 * orchestrator can delete the matching rows from our DB.
 */
async function fetchFromPlaid(
  plaidItem: PlaidItemRow
): Promise<{
  transactions: PlaidTransaction[];
  removedTransactionIds: string[];
  nextCursor: string | null;
}> {
  if (PLAID_ENV === 'sandbox') {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - SANDBOX_LOOKBACK_DAYS);

    try {
      const res = await getTransactions(
        decryptPlaidToken(plaidItem.access_token),
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      return {
        transactions: (res.transactions ?? []) as unknown as PlaidTransaction[],
        removedTransactionIds: [],
        nextCursor: null,
      };
    } catch (error) {
      const e = error as { response?: { data?: { error_message?: string } }; message?: string };
      throw new Error(`Plaid API error: ${e.response?.data?.error_message ?? e.message}`);
    }
  }

  // Production: cursor-based pagination.
  let cursor: string | null = plaidItem.transaction_cursor ?? null;
  let hasMore = true;
  const collected: PlaidTransaction[] = [];
  const removed: string[] = [];

  while (hasMore) {
    try {
      const res = await syncTransactions(decryptPlaidToken(plaidItem.access_token), cursor);
      const added = (res.added ?? []) as unknown as PlaidTransaction[];
      const modified = (res.modified ?? []) as unknown as PlaidTransaction[];
      const removedBatch = (res.removed ?? []) as Array<{ transaction_id?: string | null }>;
      collected.push(...added, ...modified);
      for (const r of removedBatch) {
        if (r?.transaction_id) removed.push(r.transaction_id);
      }
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

  return { transactions: collected, removedTransactionIds: removed, nextCursor: cursor };
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

/**
 * Drop transactions Plaid told us to remove (cancelled holds, duplicates,
 * institution-side corrections). Returns the count actually deleted.
 *
 * Without this, pending holds that get released would stay in our DB and
 * project against the displayed balance forever.
 */
async function deleteRemovedTransactions(
  removedPlaidTransactionIds: string[]
): Promise<number> {
  if (removedPlaidTransactionIds.length === 0) return 0;
  const { error, count } = await supabaseAdmin
    .from('transactions')
    .delete({ count: 'exact' })
    .in('plaid_transaction_id', removedPlaidTransactionIds);
  if (error) {
    logger.error('Failed to delete removed transactions', null, {
      error,
      ids_count: removedPlaidTransactionIds.length,
    });
    return 0;
  }
  return count ?? 0;
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

/**
 * Reconcile each account's stored balance with what Plaid just returned.
 *
 * Plaid's /accounts/get response is cached at the institution and only
 * refreshes ~once a day. Naively writing the cached value over our own
 * displayed balance means new transactions we *just* synced have no
 * visible effect on the headline number until Plaid's next refresh.
 *
 * Two-layer model:
 *
 *   - **Checkpoint** (`plaid_balance_*` columns): the last value Plaid
 *     itself confirmed. Only moves when Plaid returns a different
 *     number, at which point we accept it as the new baseline and
 *     reset `plaid_balance_as_of`.
 *
 *   - **Displayed** (`balances` JSON, what every UI reader already
 *     consumes): the checkpoint + every posted transaction with
 *     `date > checkpoint_as_of::date`, sign-flipped for credit-style
 *     accounts. Recomputed every sync.
 *
 * Snapshots are created on checkpoint changes only, not on projection
 * deltas — otherwise the balance-history chart fills with transient
 * wobbles that disappear at the next Plaid refresh.
 */
async function updateAccountBalances(
  plaidAccounts: PlaidAccount[],
  accountMap: AccountMap
): Promise<{ updatedAccountsCount: number; snapshotsCreatedCount: number }> {
  if (plaidAccounts.length === 0) {
    return { updatedAccountsCount: 0, snapshotsCreatedCount: 0 };
  }

  // Pull every account row we might touch in one shot — type (for
  // investment exclusion + sign multiplier) and the existing
  // checkpoint columns.
  const dbAccountIds = Array.from(new Set(Object.values(accountMap)));
  interface AccountStateRow {
    id: string;
    type: string | null;
    plaid_balance_current: number | null;
    plaid_balance_available: number | null;
    plaid_balance_as_of: string | null;
  }
  const accountStateById = new Map<string, AccountStateRow>();
  if (dbAccountIds.length > 0) {
    const { data: stateRows, error: stateError } = await supabaseAdmin
      .from('accounts')
      .select(
        'id, type, plaid_balance_current, plaid_balance_available, plaid_balance_as_of'
      )
      .in('id', dbAccountIds);
    if (stateError) {
      // Without checkpoint state we can't safely project. Bail rather
      // than risk corrupting balances; the next sync will retry.
      logger.error('Failed to fetch account state for balance update', null, {
        error: stateError,
      });
      return { updatedAccountsCount: 0, snapshotsCreatedCount: 0 };
    }
    for (const row of (stateRows ?? []) as AccountStateRow[]) {
      accountStateById.set(row.id, row);
    }
  }

  let updatedAccountsCount = 0;
  let snapshotsCreatedCount = 0;

  for (const plaidAccount of plaidAccounts) {
    const dbAccountId = accountMap[plaidAccount.account_id];
    if (!dbAccountId || !plaidAccount.balances) continue;

    const acct = accountStateById.get(dbAccountId);
    if (!acct) continue;
    // Investment accounts: holdings sync owns the balance. Don't touch.
    if (acct.type === 'investment') continue;

    const incomingCurrent =
      typeof plaidAccount.balances.current === 'number'
        ? plaidAccount.balances.current
        : null;
    const incomingAvailable =
      typeof plaidAccount.balances.available === 'number'
        ? plaidAccount.balances.available
        : null;

    // Did Plaid's cache refresh? If so, accept the new value as the
    // canonical checkpoint; otherwise hold the previous one steady so
    // already-projected transactions don't get baked in twice.
    const checkpointChanged = isCheckpointChange(
      incomingCurrent,
      acct.plaid_balance_current
    );
    const checkpointCurrent = checkpointChanged
      ? incomingCurrent
      : acct.plaid_balance_current;
    const checkpointAvailable = checkpointChanged
      ? incomingAvailable
      : acct.plaid_balance_available;
    const checkpointAsOf =
      checkpointChanged || !acct.plaid_balance_as_of
        ? new Date().toISOString()
        : acct.plaid_balance_as_of;

    // Compute the delta to project on top of the checkpoint. Two
    // contributors:
    //
    //   - Posted transactions ingested AFTER the checkpoint — Plaid's
    //     `current` includes posted but its cache lags, so anything
    //     posted that we ingested after `as_of` is by definition not
    //     in the checkpoint yet.
    //
    //   - Pending transactions, regardless of `as_of` — Plaid's
    //     `current` excludes pending entirely, so they're never in
    //     the checkpoint. We project them so things like a fresh
    //     refund show up in the headline number immediately. Bounded
    //     to the last 14 days as a safety net against any orphaned
    //     pending rows that escape the `removed` array (Plaid drops
    //     real pending holds within ~7 days).
    //
    // We use `created_at` (when we ingested) rather than the calendar
    // `date` column because date has a boundary-day ambiguity: a tx
    // with the same calendar day as the checkpoint may or may not be
    // in Plaid's cached balance and we can't tell. created_at is
    // unambiguous.
    const PENDING_PROJECTION_MAX_AGE_DAYS = 14;
    const pendingFloorMs =
      Date.now() - PENDING_PROJECTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const pendingFloorIso = new Date(pendingFloorMs).toISOString();

    let deltaSum = 0;
    if (checkpointCurrent !== null) {
      // Posted, ingested after the checkpoint.
      const { data: postedDeltas, error: postedErr } = await supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('account_id', dbAccountId)
        .eq('pending', false)
        .gt('created_at', checkpointAsOf);
      if (postedErr) {
        logger.warn('Failed to sum posted-tx deltas for projection', {
          account_id: plaidAccount.account_id,
          error: postedErr.message,
        });
      } else {
        for (const row of (postedDeltas ?? []) as Array<{ amount: number | null }>) {
          deltaSum += Number(row.amount ?? 0);
        }
      }

      // All currently-pending, capped by age.
      const { data: pendingDeltas, error: pendingErr } = await supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('account_id', dbAccountId)
        .eq('pending', true)
        .gt('created_at', pendingFloorIso);
      if (pendingErr) {
        logger.warn('Failed to sum pending-tx deltas for projection', {
          account_id: plaidAccount.account_id,
          error: pendingErr.message,
        });
      } else {
        for (const row of (pendingDeltas ?? []) as Array<{ amount: number | null }>) {
          deltaSum += Number(row.amount ?? 0);
        }
      }
    }

    const projectedCurrent = projectCurrent(checkpointCurrent, deltaSum, acct.type);

    // Build the displayed balance JSON. Take Plaid's incoming object as
    // the base (preserves currency_code + limit), then override `current`
    // with the projection. `available` stays as Plaid's value for now —
    // projecting it correctly requires modeling pending tx differently.
    const projectedBalances = {
      ...plaidAccount.balances,
      current: projectedCurrent,
    };

    const updates: TablesUpdate<'accounts'> = {
      balances: projectedBalances as unknown as TablesUpdate<'accounts'>['balances'],
      updated_at: new Date().toISOString(),
    };
    if (checkpointChanged) {
      updates.plaid_balance_current = checkpointCurrent;
      updates.plaid_balance_available = checkpointAvailable;
      updates.plaid_balance_as_of = checkpointAsOf;
    }

    const { error: updateError } = await supabaseAdmin
      .from('accounts')
      .update(updates)
      .eq('id', dbAccountId);

    if (updateError) {
      logger.error('Failed to update account balance', null, {
        account_id: plaidAccount.account_id,
        error: updateError,
      });
      continue;
    }

    updatedAccountsCount++;

    // Snapshot only on real Plaid checkpoint moves so the balance-history
    // chart records vetted values, not transient projections. Snapshot
    // the checkpoint, not the projection.
    if (checkpointChanged) {
      try {
        const snapshotResult = (await createAccountSnapshotConditional(
          {
            balances: {
              ...plaidAccount.balances,
              current: checkpointCurrent,
              available: checkpointAvailable,
            },
          },
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
  }

  return { updatedAccountsCount, snapshotsCreatedCount };
}

/**
 * For every row about to be upserted, look up whether its
 * plaid_transaction_id already exists in the DB with
 * is_user_categorized = true. If so, copy the stored category_id back
 * onto the row. This is the only thing preventing the Plaid PFC (or a
 * rule match) from overwriting a category the user set by hand.
 *
 * Returns the number of rows whose category_id was preserved.
 */
async function preserveUserCategories(rows: TransactionUpsertRow[]): Promise<number> {
  const plaidIds = rows
    .map((r) => r.plaid_transaction_id)
    .filter((id): id is string => Boolean(id));
  if (plaidIds.length === 0) return 0;

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('plaid_transaction_id, category_id')
    .in('plaid_transaction_id', plaidIds)
    .eq('is_user_categorized', true);

  if (error) {
    // Non-fatal — better to let the sync proceed and potentially
    // overwrite than to fail the whole batch. The user can always
    // recategorise again.
    logger.warn('Failed to look up user-categorized transactions; sync will not preserve them', {
      error: error.message,
    });
    return 0;
  }

  const preserved = (data ?? []) as Array<{
    plaid_transaction_id: string | null;
    category_id: string | null;
  }>;
  if (preserved.length === 0) return 0;

  const preserveMap = new Map<string, string | null>();
  for (const row of preserved) {
    if (row.plaid_transaction_id) {
      preserveMap.set(row.plaid_transaction_id, row.category_id);
    }
  }

  let count = 0;
  for (const row of rows) {
    if (!row.plaid_transaction_id) continue;
    if (preserveMap.has(row.plaid_transaction_id)) {
      row.category_id = preserveMap.get(row.plaid_transaction_id) ?? null;
      count++;
    }
  }
  return count;
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

