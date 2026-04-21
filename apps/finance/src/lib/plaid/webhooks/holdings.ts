/**
 * HOLDINGS webhook handler.
 *
 * Webhook codes handled:
 *   - DEFAULT_UPDATE → trigger a holdings sync for the item.
 *
 * Failure webhooks (`error` claim set on the payload) are logged and
 * dropped — they carry no actionable item for us.
 */

import { syncHoldingsForItem } from '../holdingsSync';
import { loadPlaidItemByItemId } from './loadItem';
import type { HoldingsWebhookPayload, WebhookLogger } from './types';

export async function handleHoldingsWebhook(
  webhookData: HoldingsWebhookPayload,
  logger: WebhookLogger
): Promise<void> {
  const { webhook_code, item_id, error, new_holdings, updated_holdings } = webhookData;
  const holdingsLogger = logger.child('holdings');

  holdingsLogger.info('Processing HOLDINGS webhook', {
    webhook_code,
    item_id,
    has_error: !!error,
    new_holdings: new_holdings ?? 0,
    updated_holdings: updated_holdings ?? 0,
  });

  if (error) {
    holdingsLogger.error('Holdings webhook contains error', null, {
      item_id,
      error_type: error.error_type,
      error_code: error.error_code,
      error_message: error.error_message,
    });
    return;
  }

  const plaidItem = await loadPlaidItemByItemId(item_id, holdingsLogger);
  if (!plaidItem) return;

  switch (webhook_code) {
    case 'DEFAULT_UPDATE':
      holdingsLogger.info('Triggering holdings sync', { item_id, webhook_code });

      try {
        const syncResult = await syncHoldingsForItem({
          plaidItemId: plaidItem.id,
          userId: plaidItem.user_id,
          forceSync: false,
        });

        holdingsLogger.info('Holdings sync completed', {
          item_id,
          holdings_synced: syncResult.holdings_synced,
        });
      } catch (syncError) {
        holdingsLogger.error('Error in webhook-triggered holdings sync', syncError as Error, {
          item_id,
        });
      }
      break;

    default:
      holdingsLogger.warn('Unhandled holdings webhook code', { webhook_code });
  }
}
