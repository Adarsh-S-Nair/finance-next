/**
 * TRANSACTIONS webhook handler.
 *
 * Webhook codes handled:
 *   - INITIAL_UPDATE / HISTORICAL_UPDATE / DEFAULT_UPDATE / SYNC_UPDATES_AVAILABLE
 *     → trigger a transaction sync for the item. For HISTORICAL_UPDATE and
 *       SYNC_UPDATES_AVAILABLE, also mark the item as `recurring_ready`
 *       and kick off a recurring-sync after the transaction sync
 *       completes (Plaid's recommendation).
 *   - TRANSACTIONS_REMOVED → delete the specified plaid_transaction_ids,
 *     scoped to accounts belonging to this plaid_item.
 */

import { supabaseAdmin } from '../../supabase/admin';
import { syncTransactionsForItem } from '../transactionSync';
import { loadPlaidItemByItemId } from './loadItem';
import type {
  PlaidItemContext,
  TransactionsWebhookPayload,
  WebhookLogger,
} from './types';

export async function handleTransactionsWebhook(
  webhookData: TransactionsWebhookPayload,
  logger: WebhookLogger
): Promise<void> {
  const { webhook_code, item_id, new_transactions, removed_transactions } = webhookData;
  const txLogger = logger.child('transactions');

  txLogger.info('Processing TRANSACTIONS webhook', {
    webhook_code,
    item_id,
    new_transactions_count: new_transactions ?? 0,
    removed_transactions_count: removed_transactions?.length ?? 0,
  });

  const plaidItem = await loadPlaidItemByItemId(item_id, txLogger);
  if (!plaidItem) return;

  switch (webhook_code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
    case 'SYNC_UPDATES_AVAILABLE':
      await handleTransactionSyncTrigger(plaidItem, webhook_code, txLogger);
      break;

    case 'TRANSACTIONS_REMOVED':
      await handleTransactionsRemoved(plaidItem, removed_transactions ?? [], txLogger);
      break;

    default:
      txLogger.warn('Unhandled transaction webhook code', { webhook_code });
  }
}

// ---------------------------------------------------------------------------
// Update variants → trigger sync
// ---------------------------------------------------------------------------

async function handleTransactionSyncTrigger(
  plaidItem: PlaidItemContext,
  webhook_code: string,
  txLogger: WebhookLogger
): Promise<void> {
  txLogger.info('Triggering transaction sync', {
    item_id: plaidItem.item_id,
    webhook_code,
  });

  // Mark item as ready for recurring transactions on history-related codes.
  if (webhook_code === 'HISTORICAL_UPDATE' || webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    const { error: updateReadyError } = await supabaseAdmin
      .from('plaid_items')
      .update({ recurring_ready: true })
      .eq('id', plaidItem.id);

    if (updateReadyError) {
      txLogger.error('Error updating recurring_ready', null, { error: updateReadyError });
    } else {
      txLogger.info('Marked item as recurring_ready', {
        item_id: plaidItem.item_id,
        webhook_code,
      });
    }
  }

  try {
    const syncResult = await syncTransactionsForItem({
      plaidItemId: plaidItem.id,
      userId: plaidItem.user_id,
      forceSync: false,
    });

    txLogger.info('Transaction sync completed', {
      item_id: plaidItem.item_id,
      transactions_synced: syncResult.transactions_synced,
      pending_transactions_updated: syncResult.pending_transactions_updated,
    });

    // After history-related codes, auto-trigger recurring sync for this item
    // — Plaid recommends calling /transactions/recurring/get once transaction
    // history is available.
    if (webhook_code === 'HISTORICAL_UPDATE' || webhook_code === 'SYNC_UPDATES_AVAILABLE') {
      await triggerRecurringSync(plaidItem, txLogger);
    }
  } catch (error) {
    txLogger.error('Error in webhook-triggered transaction sync', error as Error, {
      item_id: plaidItem.item_id,
    });
  }
}

// ---------------------------------------------------------------------------
// TRANSACTIONS_REMOVED
// ---------------------------------------------------------------------------

/**
 * Delete the transactions identified by Plaid's `removed_transactions`
 * array, scoped to accounts belonging to this plaid_item.
 *
 * The legacy route deleted purely by `plaid_transaction_id`, trusting
 * Plaid to only send IDs from this item. We tighten the delete here by
 * joining through the account list — even if Plaid sends bad data, the
 * delete can't escape the item's own accounts.
 */
async function handleTransactionsRemoved(
  plaidItem: PlaidItemContext,
  removed_transactions: string[],
  txLogger: WebhookLogger
): Promise<void> {
  if (removed_transactions.length === 0) return;

  txLogger.info('Removing transactions', {
    item_id: plaidItem.item_id,
    count: removed_transactions.length,
  });

  // Look up the account ids for this plaid_item so we can scope the
  // delete. This is cheap (bounded by the number of accounts on one item).
  const { data: accountRows, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('plaid_item_id', plaidItem.id);

  if (accountsError) {
    txLogger.error('Error loading accounts for TRANSACTIONS_REMOVED scope', null, {
      error: accountsError,
    });
    return;
  }

  const accountIds = (accountRows ?? []).map((r: { id: string }) => r.id);
  if (accountIds.length === 0) {
    txLogger.warn('No accounts found for plaid_item, skipping TRANSACTIONS_REMOVED', {
      item_id: plaidItem.item_id,
    });
    return;
  }

  const { error: deleteError } = await supabaseAdmin
    .from('transactions')
    .delete()
    .in('plaid_transaction_id', removed_transactions)
    .in('account_id', accountIds);

  if (deleteError) {
    txLogger.error('Error removing transactions', null, { error: deleteError });
    return;
  }

  txLogger.info('Successfully removed transactions', {
    count: removed_transactions.length,
    item_id: plaidItem.item_id,
  });
}

// ---------------------------------------------------------------------------
// Recurring sync trigger (still HTTP because recurring sync isn't yet a lib)
// ---------------------------------------------------------------------------

// TODO(recurring-sync): extract /api/plaid/recurring/sync into a lib
// function and call it directly here, same as syncTransactionsForItem.
async function triggerRecurringSync(
  plaidItem: PlaidItemContext,
  txLogger: WebhookLogger
): Promise<void> {
  try {
    const { POST: recurringSyncEndpoint } = await import(
      '../../../app/api/plaid/recurring/sync/route.js'
    );
    const recurringSyncRequest = {
      headers: { get: () => null },
      json: async () => ({
        userId: plaidItem.user_id,
        plaidItemId: plaidItem.id,
      }),
    };
    const recurringResponse = await recurringSyncEndpoint(recurringSyncRequest);
    if (recurringResponse.ok) {
      const recurringResult = await recurringResponse.json();
      txLogger.info('Recurring sync completed after transaction sync', {
        item_id: plaidItem.item_id,
        synced: recurringResult.synced,
      });
    }
  } catch (recurringError) {
    // Non-fatal — recurring will be picked up by webhook later.
    txLogger.warn('Recurring sync failed after transaction sync', {
      item_id: plaidItem.item_id,
      error: (recurringError as Error).message,
    });
  }
}
