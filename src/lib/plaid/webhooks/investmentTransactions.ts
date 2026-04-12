/**
 * INVESTMENTS_TRANSACTIONS webhook handler.
 *
 * Webhook codes handled:
 *   - DEFAULT_UPDATE / HISTORICAL_UPDATE → trigger an investment
 *     transactions sync for the item.
 *
 * Failure webhooks (`error` claim set on the payload) are logged and
 * dropped.
 */

import { syncInvestmentTransactionsForItem } from '../investmentTransactionSync';
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
    const result = await syncInvestmentTransactionsForItem({
      plaidItemId: plaidItem.id,
      userId: plaidItem.user_id,
    });
    invTxLogger.info('Investment transactions sync completed', {
      item_id: plaidItem.item_id,
      transactions_synced: result.transactions_synced,
    });
  } catch (syncError) {
    invTxLogger.error(
      'Error in webhook-triggered investment transactions sync',
      syncError as Error,
      { item_id: plaidItem.item_id }
    );
  }
}
