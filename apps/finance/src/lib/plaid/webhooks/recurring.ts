/**
 * RECURRING_TRANSACTIONS webhook handler.
 *
 * Webhook codes handled:
 *   - RECURRING_TRANSACTIONS_UPDATE → trigger a recurring-transactions
 *     sync for the item.
 */

import { syncRecurringForUser } from '../recurringSync';
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
    const result = await syncRecurringForUser({
      userId: plaidItem.user_id,
      plaidItemId: plaidItem.id,
    });
    recurringLogger.info('Recurring transactions sync completed', {
      item_id: plaidItem.item_id,
      synced: result.synced,
    });
  } catch (syncError) {
    recurringLogger.error('Error in webhook-triggered recurring sync', syncError as Error, {
      item_id: plaidItem.item_id,
    });
  }
}
