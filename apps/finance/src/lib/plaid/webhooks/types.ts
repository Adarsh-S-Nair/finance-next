/**
 * Types for the Plaid webhook pipeline.
 *
 * Narrow by design: we declare only the fields we actually read. Plaid
 * sends many more — we ignore them.
 *
 * Reference: https://plaid.com/docs/api/webhooks/
 */

export type PlaidWebhookType =
  | 'TRANSACTIONS'
  | 'ITEM'
  | 'HOLDINGS'
  | 'INVESTMENTS_TRANSACTIONS'
  | 'RECURRING_TRANSACTIONS';

export interface BaseWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
}

export interface TransactionsWebhookPayload extends BaseWebhookPayload {
  webhook_type: 'TRANSACTIONS';
  new_transactions?: number;
  removed_transactions?: string[];
}

export interface ItemWebhookPayload extends BaseWebhookPayload {
  webhook_type: 'ITEM';
  error?: {
    error_type?: string;
    error_code?: string;
    error_message?: string;
  };
}

export interface HoldingsWebhookPayload extends BaseWebhookPayload {
  webhook_type: 'HOLDINGS';
  error?: {
    error_type?: string;
    error_code?: string;
    error_message?: string;
  };
  new_holdings?: number;
  updated_holdings?: number;
}

export interface InvestmentsTransactionsWebhookPayload extends BaseWebhookPayload {
  webhook_type: 'INVESTMENTS_TRANSACTIONS';
  error?: {
    error_type?: string;
    error_code?: string;
    error_message?: string;
  };
  new_investments_transactions?: number;
  canceled_investments_transactions?: number;
}

export interface RecurringTransactionsWebhookPayload extends BaseWebhookPayload {
  webhook_type: 'RECURRING_TRANSACTIONS';
}

export type PlaidWebhookPayload =
  | TransactionsWebhookPayload
  | ItemWebhookPayload
  | HoldingsWebhookPayload
  | InvestmentsTransactionsWebhookPayload
  | RecurringTransactionsWebhookPayload
  | (BaseWebhookPayload & { webhook_type: string }); // fallback for unknown types

/**
 * Minimal shape of the plaid_items row we read inside handlers.
 * Keep this narrow so it's easy to stub in tests.
 */
export interface PlaidItemContext {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
}

/**
 * Logger interface that the webhook pipeline accepts. Matches the public
 * surface of `src/lib/logger.js` — defined here so tests can pass a spy.
 */
export interface WebhookLogger {
  child(context: string): WebhookLogger;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error | null, metadata?: Record<string, unknown>): void;
}
