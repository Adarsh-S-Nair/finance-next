/**
 * Recurring transactions sync orchestrator.
 *
 * This is the single entry point that every caller should use:
 *   - The `/api/plaid/recurring/sync` route (via a thin wrapper)
 *   - The Plaid RECURRING_TRANSACTIONS webhook handler
 *   - The transaction-sync chained call that fires recurring after a
 *     regular transaction sync completes
 *
 * Pattern: routes are thin (parse + dispatch + format response). Business
 * logic lives here. See `docs/architectural_patterns.md`.
 *
 * Wire-shape contract: this function returns the exact field shape the
 * legacy route did — `{ success, synced, customDetected, itemsProcessed,
 * errors?, itemsNeedingConsent? }` on the normal flow, and the two
 * degenerate shapes documented on `RecurringSyncResult` when the user has
 * no connected accounts or no recurring-ready items.
 */

import { getPlaidClient } from '../client';
import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
import { detectMissedRecurring } from '../../recurringGapFiller';
import { decryptPlaidToken } from '../../crypto/plaidTokens';

import { buildStreamRecords } from './buildRecord';
import type {
  PlaidRecurringStream,
  RecurringItemError,
  RecurringStreamRecord,
  RecurringSyncResult,
} from './types';
import type { TablesInsert } from '../../../types/database';

const logger = createLogger('recurring-sync');

interface PlaidItemRow {
  id: string;
  access_token: string;
  recurring_ready: boolean | null;
}

export interface SyncParams {
  userId: string;
  /** Optional: scope the sync to a single item. If omitted, syncs every
   *  recurring-ready item for the user. */
  plaidItemId?: string | null;
  /** If true, deletes all of the user's existing recurring_streams rows
   *  before re-syncing. Used after subscription upgrades to guarantee
   *  a clean slate. */
  forceReset?: boolean;
}

/**
 * Sync recurring transaction streams for a user (or a single item) end-to-end.
 *
 * Never throws on per-item failures — those are captured into the
 * `errors` array and returned so the caller can report them. Throws only
 * on unrecoverable DB errors.
 */
export async function syncRecurringForUser(params: SyncParams): Promise<RecurringSyncResult> {
  const { userId, plaidItemId = null, forceReset = false } = params;

  logger.info('Starting recurring transactions sync', { userId, forceReset, plaidItemId });

  if (forceReset) {
    await deleteExistingStreams(userId);
  }

  const allItems = await loadPlaidItems(userId, plaidItemId);

  if (allItems.length === 0) {
    logger.info('No plaid items found for user', { userId });
    await logger.flush();
    return {
      success: true,
      synced: 0,
      message: 'No connected accounts',
    };
  }

  // Filter to recurring-ready items. Plaid takes a while after linking to
  // detect recurring patterns, so we gate on a `recurring_ready` flag set
  // by the /transactions/sync path once enough history has been collected.
  const plaidItems = allItems.filter((item) => item.recurring_ready === true);
  const notReadyCount = allItems.length - plaidItems.length;

  if (notReadyCount > 0) {
    logger.info('Some items not ready for recurring detection', {
      userId,
      readyCount: plaidItems.length,
      notReadyCount,
    });
  }

  if (plaidItems.length === 0) {
    logger.info('No items ready for recurring detection yet', { userId });
    await logger.flush();
    return {
      success: true,
      synced: 0,
      message: 'Accounts are still syncing transaction history. Please try again later.',
      itemsNotReady: notReadyCount,
    };
  }

  // --- Per-item sync loop ---
  const { totalSynced, errors } = await syncItems(plaidItems, userId);

  // --- Gap filler pass ---
  const customDetected = await runGapFiller(plaidItems, userId);

  // --- Separate consent errors from fatal errors so the caller can
  //     surface a consent-prompt UI without marking the whole sync failed.
  const consentErrors = errors.filter((e) => e.errorCode === 'ADDITIONAL_CONSENT_REQUIRED');
  const otherErrors = errors.filter((e) => e.errorCode !== 'ADDITIONAL_CONSENT_REQUIRED');

  await logger.flush();

  return {
    success: otherErrors.length === 0,
    synced: totalSynced,
    customDetected,
    itemsProcessed: plaidItems.length,
    errors: otherErrors.length > 0 ? otherErrors : undefined,
    itemsNeedingConsent:
      consentErrors.length > 0 ? consentErrors.map((e) => e.plaidItemId) : undefined,
  };
}

// ---------------------------------------------------------------------------
// IO helpers — private to the module.
// ---------------------------------------------------------------------------

async function deleteExistingStreams(userId: string): Promise<void> {
  logger.info('Force reset: deleting existing recurring streams', { userId });
  const { error: deleteError } = await supabaseAdmin
    .from('recurring_streams')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    // Non-fatal — we log and continue. The upsert below will overwrite
    // existing rows anyway; the only thing we lose is the chance to
    // cleanly remove streams Plaid no longer reports.
    logger.error('Error deleting existing streams', null, {
      error: deleteError.message,
      code: deleteError.code,
      userId,
    });
  }
}

async function loadPlaidItems(
  userId: string,
  plaidItemId: string | null
): Promise<PlaidItemRow[]> {
  let query = supabaseAdmin
    .from('plaid_items')
    .select('id, access_token, recurring_ready')
    .eq('user_id', userId);

  if (plaidItemId) {
    query = query.eq('id', plaidItemId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch plaid items: ${error.message}`);
  }
  return (data ?? []) as PlaidItemRow[];
}

interface PlaidRecurringResponse {
  data: {
    inflow_streams?: PlaidRecurringStream[];
    outflow_streams?: PlaidRecurringStream[];
    updated_datetime?: string;
  };
}

interface PlaidClientLike {
  transactionsRecurringGet: (input: {
    access_token: string;
    options: {
      include_personal_finance_category: boolean;
      personal_finance_category_version: string;
    };
  }) => Promise<PlaidRecurringResponse>;
}

async function syncItems(
  plaidItems: PlaidItemRow[],
  userId: string
): Promise<{ totalSynced: number; errors: RecurringItemError[] }> {
  const client = getPlaidClient() as PlaidClientLike;
  let totalSynced = 0;
  const errors: RecurringItemError[] = [];

  for (const item of plaidItems) {
    try {
      logger.info('Fetching recurring transactions for item', { plaidItemId: item.id });

      // item.access_token is encrypted at rest; decrypt for outbound call.
      const response = await client.transactionsRecurringGet({
        access_token: decryptPlaidToken(item.access_token),
        options: {
          include_personal_finance_category: true,
          personal_finance_category_version: 'v2',
        },
      });

      const { inflow_streams = [], outflow_streams = [] } = response.data;

      logger.info('Received recurring streams from Plaid', {
        plaidItemId: item.id,
        inflowCount: inflow_streams.length,
        outflowCount: outflow_streams.length,
      });

      const records = buildStreamRecords({
        inflowStreams: inflow_streams,
        outflowStreams: outflow_streams,
        userId,
        plaidItemId: item.id,
      });

      if (records.length > 0) {
        await upsertRecords(records);
        totalSynced += records.length;
      }

      // Mark any streams that are no longer returned by Plaid as inactive.
      await markRemovedStreamsInactive(item.id, records);
    } catch (itemError) {
      handleItemError(item.id, itemError, errors);
    }
  }

  return { totalSynced, errors };
}

async function upsertRecords(records: RecurringStreamRecord[]): Promise<void> {
  const { error: upsertError } = await supabaseAdmin
    .from('recurring_streams')
    .upsert(records as TablesInsert<'recurring_streams'>[], {
      onConflict: 'stream_id',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Failed to upsert streams: ${upsertError.message}`);
  }
}

async function markRemovedStreamsInactive(
  plaidItemRowId: string,
  activeRecords: RecurringStreamRecord[]
): Promise<void> {
  const activeStreamIds = activeRecords.map((r) => r.stream_id);
  if (activeStreamIds.length === 0) return;

  // PostgREST `in` filter: values are joined unquoted inside parens. Plaid
  // stream_ids are alphanumeric (base62-ish) so they never contain commas
  // or parens — safe as-is. If Plaid ever changes the format, swap this
  // to a proper quoted `in.("...","...")` construction.
  await supabaseAdmin
    .from('recurring_streams')
    .update({ is_active: false })
    .eq('plaid_item_id', plaidItemRowId)
    .not('stream_id', 'in', `(${activeStreamIds.join(',')})`);
}

async function handleItemError(
  plaidItemRowId: string,
  rawError: unknown,
  errors: RecurringItemError[]
): Promise<void> {
  const err = rawError as {
    response?: { data?: { error_code?: string; error_message?: string; error_type?: string } };
    message?: string;
  };
  const errorCode = err.response?.data?.error_code ?? null;

  // PRODUCT_NOT_READY is self-correcting: Plaid hasn't finished detecting
  // recurring patterns yet. Mark the item as not-ready and move on
  // silently — this error is expected and shouldn't be surfaced to users.
  if (errorCode === 'PRODUCT_NOT_READY') {
    logger.info('Item not ready for recurring, marking as recurring_ready=false', {
      plaidItemId: plaidItemRowId,
    });
    await supabaseAdmin
      .from('plaid_items')
      .update({ recurring_ready: false })
      .eq('id', plaidItemRowId);
    return;
  }

  const errorMessage =
    err.response?.data?.error_message ||
    errorCode ||
    err.message ||
    String(rawError) ||
    'Unknown error';

  logger.error('Error syncing recurring for item', rawError as Error, {
    plaidItemId: plaidItemRowId,
    plaidErrorMessage: errorMessage,
    plaidErrorCode: errorCode,
    plaidErrorType: err.response?.data?.error_type,
  });

  errors.push({
    plaidItemId: plaidItemRowId,
    error: errorMessage,
    errorCode,
  });
}

/**
 * Run the heuristic gap filler on items that don't already have
 * Plaid-detected recurring streams. Once Plaid's ML has had time to
 * catch up, its detection is more reliable than our heuristic, so we
 * only gap-fill on the first sync per item.
 */
async function runGapFiller(
  plaidItems: PlaidItemRow[],
  userId: string
): Promise<number> {
  const { data: existingStreams } = await supabaseAdmin
    .from('recurring_streams')
    .select('plaid_item_id, merchant_name, is_custom_detected')
    .eq('user_id', userId)
    .eq('is_custom_detected', false);

  const itemsWithPlaidStreams = new Set(
    (existingStreams ?? [])
      .map((s) => s.plaid_item_id)
      .filter((id): id is string => Boolean(id))
  );
  const existingMerchants = ((existingStreams ?? []) as Array<{ merchant_name: string | null }>)
    .map((s) => s.merchant_name)
    .filter((m): m is string => Boolean(m));

  const itemsNeedingGapFiller = plaidItems.filter(
    (item) => !itemsWithPlaidStreams.has(item.id)
  );

  if (itemsNeedingGapFiller.length === 0) return 0;

  logger.info('Running gap filler for items without Plaid streams', {
    count: itemsNeedingGapFiller.length,
    skipped: plaidItems.length - itemsNeedingGapFiller.length,
  });

  let customDetected = 0;

  for (const item of itemsNeedingGapFiller) {
    try {
      const customStreams = (await detectMissedRecurring(
        userId,
        item.id,
        existingMerchants
      )) as Array<Record<string, unknown>>;

      if (customStreams.length === 0) continue;

      logger.info('Gap filler detected missed patterns', {
        plaidItemId: item.id,
        count: customStreams.length,
      });

      const { error: customUpsertError } = await supabaseAdmin
        .from('recurring_streams')
        .upsert(customStreams as TablesInsert<'recurring_streams'>[], {
          onConflict: 'stream_id',
        });

      if (customUpsertError) {
        logger.error('Error upserting custom streams', null, {
          error: customUpsertError.message,
          code: customUpsertError.code,
          details: customUpsertError.details,
          hint: customUpsertError.hint,
          plaidItemId: item.id,
        });
      } else {
        customDetected += customStreams.length;
      }
    } catch (gapError) {
      logger.error('Error in gap filler detection', gapError as Error, {
        plaidItemId: item.id,
      });
    }
  }

  return customDetected;
}

export type { RecurringSyncResult } from './types';
