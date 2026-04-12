/**
 * RECURRING_TRANSACTIONS webhook handler.
 *
 * Webhook codes handled:
 *   - RECURRING_TRANSACTIONS_UPDATE → trigger a recurring-transactions
 *     sync for the item.
 *
 * TODO(recurring-sync): the recurring sync route is still a 319-line JS
 * file at src/app/api/plaid/recurring/sync/route.js. Once it's extracted
 * into src/lib/plaid/recurringSync/, replace the dynamic-import dance
 * below with a direct lib call.
 */

import { loadPlaidItemByItemId } from './loadItem';
import type {
  PlaidItemContext,
  RecurringTransactionsWebhookPayload,
  WebhookLogger,
} from './types';

export async function handleRecurringTransactionsWebhook(
  webhookData: RecurringTransactionsWebhookPayload,
  logger: WebhookLogger
): Promise<void> {
  const { webhook_code, item_id } = webhookData;
  const recurringLogger = logger.child('recurring');

  recurringLogger.info('Processing RECURRING_TRANSACTIONS webhook', {
    webhook_code,
    item_id,
  });

  const plaidItem = await loadPlaidItemByItemId(item_id, recurringLogger);
  if (!plaidItem) return;

  switch (webhook_code) {
    case 'RECURRING_TRANSACTIONS_UPDATE':
      await triggerRecurringSync(plaidItem, recurringLogger);
      break;
    default:
      recurringLogger.warn('Unhandled recurring transactions webhook code', { webhook_code });
  }
}

async function triggerRecurringSync(
  plaidItem: PlaidItemContext,
  recurringLogger: WebhookLogger
): Promise<void> {
  recurringLogger.info('Triggering recurring transactions sync', {
    item_id: plaidItem.item_id,
  });

  try {
    const { POST: syncEndpoint } = await import(
      '../../../app/api/plaid/recurring/sync/route.js'
    );
    const syncRequest = {
      headers: { get: () => null },
      json: async () => ({
        userId: plaidItem.user_id,
        plaidItemId: plaidItem.id,
      }),
    };
    const syncResponse = await syncEndpoint(syncRequest);
    if (syncResponse.ok) {
      const syncResult = await syncResponse.json();
      recurringLogger.info('Recurring transactions sync completed', {
        item_id: plaidItem.item_id,
        synced: syncResult.synced,
      });
    } else {
      const errorData = await syncResponse.json();
      recurringLogger.error('Recurring transactions sync failed', null, {
        item_id: plaidItem.item_id,
        error: errorData,
      });
    }
  } catch (syncError) {
    recurringLogger.error('Error in webhook-triggered recurring sync', syncError as Error, {
      item_id: plaidItem.item_id,
    });
  }
}
