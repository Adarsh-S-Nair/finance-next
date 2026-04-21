/**
 * Pure webhook dispatch logic.
 *
 * This file is intentionally isolated from the real handler implementations
 * so it can be unit-tested without pulling in the entire handler import
 * chain (which transitively depends on Supabase, Plaid, CoinGecko, etc.).
 *
 * `index.ts` is the file that binds these routes to the real handlers and
 * exposes the public `processPlaidWebhook` entry point.
 */

import type {
  HoldingsWebhookPayload,
  InvestmentsTransactionsWebhookPayload,
  ItemWebhookPayload,
  PlaidWebhookPayload,
  RecurringTransactionsWebhookPayload,
  TransactionsWebhookPayload,
  WebhookLogger,
} from './types';

export type HandlerFn<P> = (payload: P, logger: WebhookLogger) => Promise<void>;

/**
 * Injected handler table. Each field points to the function that should
 * run for its webhook_type. Split out as a type so tests can pass a table
 * of spies without importing the real (IO-heavy) handlers.
 */
export interface WebhookHandlers {
  transactions: HandlerFn<TransactionsWebhookPayload>;
  item: HandlerFn<ItemWebhookPayload>;
  holdings: HandlerFn<HoldingsWebhookPayload>;
  investmentTransactions: HandlerFn<InvestmentsTransactionsWebhookPayload>;
  recurring: HandlerFn<RecurringTransactionsWebhookPayload>;
}

/**
 * Route a parsed webhook payload to the handler for its `webhook_type`.
 */
export async function dispatch(
  webhookData: PlaidWebhookPayload,
  handlers: WebhookHandlers,
  logger: WebhookLogger
): Promise<void> {
  switch (webhookData.webhook_type) {
    case 'TRANSACTIONS':
      await handlers.transactions(webhookData as TransactionsWebhookPayload, logger);
      return;
    case 'ITEM':
      await handlers.item(webhookData as ItemWebhookPayload, logger);
      return;
    case 'HOLDINGS':
      await handlers.holdings(webhookData as HoldingsWebhookPayload, logger);
      return;
    case 'INVESTMENTS_TRANSACTIONS':
      await handlers.investmentTransactions(
        webhookData as InvestmentsTransactionsWebhookPayload,
        logger
      );
      return;
    case 'RECURRING_TRANSACTIONS':
      await handlers.recurring(webhookData as RecurringTransactionsWebhookPayload, logger);
      return;
    default:
      logger.warn('Unhandled webhook type', { webhook_type: webhookData.webhook_type });
  }
}
