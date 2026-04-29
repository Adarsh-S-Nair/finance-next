/**
 * LIABILITIES webhook handler.
 *
 * Webhook codes handled:
 *   - DEFAULT_UPDATE → trigger a liabilities sync for the item.
 *
 * Failure webhooks (`error` claim set on the payload) are logged and
 * dropped — they carry no actionable item for us.
 */

import { syncLiabilitiesForItem } from '../liabilitiesSync';
import { loadPlaidItemByItemId } from './loadItem';
import type { LiabilitiesWebhookPayload, WebhookLogger } from './types';

export async function handleLiabilitiesWebhook(
  webhookData: LiabilitiesWebhookPayload,
  logger: WebhookLogger
): Promise<void> {
  const {
    webhook_code,
    item_id,
    error,
    account_ids_with_new_liabilities,
    account_ids_with_updated_liabilities,
  } = webhookData;
  const liabilitiesLogger = logger.child('liabilities');

  liabilitiesLogger.info('Processing LIABILITIES webhook', {
    webhook_code,
    item_id,
    has_error: !!error,
    new_count: account_ids_with_new_liabilities?.length ?? 0,
    updated_count: account_ids_with_updated_liabilities
      ? Object.keys(account_ids_with_updated_liabilities).length
      : 0,
  });

  if (error) {
    liabilitiesLogger.error('Liabilities webhook contains error', null, {
      item_id,
      error_type: error.error_type,
      error_code: error.error_code,
      error_message: error.error_message,
    });
    return;
  }

  const plaidItem = await loadPlaidItemByItemId(item_id, liabilitiesLogger);
  if (!plaidItem) return;

  switch (webhook_code) {
    case 'DEFAULT_UPDATE':
      liabilitiesLogger.info('Triggering liabilities sync', { item_id, webhook_code });

      try {
        const syncResult = await syncLiabilitiesForItem({
          plaidItemId: plaidItem.id,
          userId: plaidItem.user_id,
        });

        liabilitiesLogger.info('Liabilities sync completed', {
          item_id,
          liabilities_synced: syncResult.liabilities_synced,
        });
      } catch (syncError) {
        liabilitiesLogger.error(
          'Error in webhook-triggered liabilities sync',
          syncError as Error,
          { item_id },
        );
      }
      break;

    default:
      liabilitiesLogger.warn('Unhandled liabilities webhook code', { webhook_code });
  }
}
