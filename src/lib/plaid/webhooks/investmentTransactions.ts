/**
 * INVESTMENTS_TRANSACTIONS webhook handler.
 *
 * Webhook codes handled:
 *   - DEFAULT_UPDATE / HISTORICAL_UPDATE → trigger an investment
 *     transactions sync for the item.
 *
 * Failure webhooks (`error` claim set on the payload) are logged and
 * dropped.
 *
 * TODO(investment-transactions-sync): this handler still calls the sync
 * via a dynamic import + fake request object because the route hasn't
 * been extracted into a lib function yet. When that's done, replace the
 * `triggerInvestmentTransactionsSync` body with a direct lib call, same
 * as handleTransactionsWebhook and handleHoldingsWebhook do today.
 */

import { loadPlaidItemByItemId } from './loadItem';
import type {
  InvestmentsTransactionsWebhookPayload,
  PlaidItemContext,
  WebhookLogger,
} from './types';

export async function handleInvestmentTransactionsWebhook(
  webhookData: InvestmentsTransactionsWebhookPayload,
  logger: WebhookLogger
): Promise<void> {
  const {
    webhook_code,
    item_id,
    error,
    new_investments_transactions,
    canceled_investments_transactions,
  } = webhookData;
  const invTxLogger = logger.child('investment-transactions');

  invTxLogger.info('Processing INVESTMENTS_TRANSACTIONS webhook', {
    webhook_code,
    item_id,
    has_error: !!error,
    new_investments_transactions: new_investments_transactions ?? 0,
    canceled_investments_transactions: canceled_investments_transactions ?? 0,
  });

  if (error) {
    invTxLogger.error('Investment transactions webhook contains error', null, {
      item_id,
      error_type: error.error_type,
      error_code: error.error_code,
      error_message: error.error_message,
    });
    return;
  }

  const plaidItem = await loadPlaidItemByItemId(item_id, invTxLogger);
  if (!plaidItem) return;

  switch (webhook_code) {
    case 'DEFAULT_UPDATE':
    case 'HISTORICAL_UPDATE':
      await triggerInvestmentTransactionsSync(plaidItem, invTxLogger);
      break;
    default:
      invTxLogger.warn('Unhandled investment transactions webhook code', { webhook_code });
  }
}

async function triggerInvestmentTransactionsSync(
  plaidItem: PlaidItemContext,
  invTxLogger: WebhookLogger
): Promise<void> {
  invTxLogger.info('Triggering investment transactions sync', {
    item_id: plaidItem.item_id,
  });

  try {
    // TODO: replace with direct lib call once investment transactions sync
    // is extracted into src/lib/plaid/investmentTransactionsSync/.
    const { POST: syncEndpoint } = await import(
      '../../../app/api/plaid/investments/transactions/sync/route.js'
    );
    const syncRequest = {
      headers: { get: () => null },
      json: async () => ({
        plaidItemId: plaidItem.id,
        userId: plaidItem.user_id,
        forceSync: false,
      }),
    };
    const syncResponse = await syncEndpoint(syncRequest);
    if (syncResponse.ok) {
      const syncResult = await syncResponse.json();
      invTxLogger.info('Investment transactions sync completed', {
        item_id: plaidItem.item_id,
        transactions_synced: syncResult.transactions_synced,
      });
    } else {
      const errorData = await syncResponse.json();
      invTxLogger.error('Investment transactions sync failed', null, {
        item_id: plaidItem.item_id,
        error: errorData,
      });
    }
  } catch (syncError) {
    invTxLogger.error(
      'Error in webhook-triggered investment transactions sync',
      syncError as Error,
      { item_id: plaidItem.item_id }
    );
  }
}
