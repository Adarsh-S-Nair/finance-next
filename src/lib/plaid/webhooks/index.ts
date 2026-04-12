/**
 * Plaid webhook pipeline entry point.
 *
 * `processPlaidWebhook` is the single function the HTTP route calls. It
 * verifies the signature, parses the JSON, and dispatches to the right
 * event-type handler.
 *
 * The dispatching logic itself lives in `dispatcher.ts` and is unit-tested
 * in isolation. This file just binds the real handlers to the dispatcher
 * and provides the public entry point.
 *
 * See `docs/architectural_patterns.md`.
 */

import { createLogger } from '../../logger';
import { dispatch, type WebhookHandlers } from './dispatcher';
import { handleHoldingsWebhook } from './holdings';
import { handleInvestmentTransactionsWebhook } from './investmentTransactions';
import { handleItemWebhook } from './item';
import { handleRecurringTransactionsWebhook } from './recurring';
import { handleTransactionsWebhook } from './transactions';
import type { PlaidWebhookPayload, WebhookLogger } from './types';
import { verifyWebhookSignature } from './verify';

export type { WebhookLogger, PlaidWebhookPayload } from './types';
export type { WebhookHandlers } from './dispatcher';
export { dispatch } from './dispatcher';
export { verifyWebhookSignature } from './verify';

export interface ProcessWebhookInput {
  payload: string;
  signature: string | null;
}

export type ProcessWebhookStatus =
  | 'disabled'
  | 'success'
  | 'invalid_signature'
  | 'parse_error'
  | 'error';

export interface ProcessWebhookResult {
  status: ProcessWebhookStatus;
  webhook_type?: string;
}

export const defaultHandlers: WebhookHandlers = {
  transactions: handleTransactionsWebhook,
  item: handleItemWebhook,
  holdings: handleHoldingsWebhook,
  investmentTransactions: handleInvestmentTransactionsWebhook,
  recurring: handleRecurringTransactionsWebhook,
};

/**
 * Process an incoming Plaid webhook end-to-end.
 *
 * Returns a status code the route handler can map to an HTTP response
 * without needing to know anything about Plaid's payload shape.
 */
export async function processPlaidWebhook(
  input: ProcessWebhookInput,
  opts: { logger?: WebhookLogger; handlers?: WebhookHandlers } = {}
): Promise<ProcessWebhookResult> {
  const logger = opts.logger ?? (createLogger('plaid-webhook') as WebhookLogger);
  const handlers = opts.handlers ?? defaultHandlers;

  const { payload, signature } = input;

  logger.info('Webhook received', {
    hasSignature: !!signature,
    payloadLength: payload.length,
  });

  if (!(await verifyWebhookSignature({ payload, signature, logger }))) {
    logger.error('Invalid webhook signature');
    return { status: 'invalid_signature' };
  }

  let webhookData: PlaidWebhookPayload;
  try {
    webhookData = JSON.parse(payload) as PlaidWebhookPayload;
  } catch (parseError) {
    logger.error('Failed to parse webhook payload', parseError as Error);
    return { status: 'parse_error' };
  }

  logger.info('Webhook verified and parsed', {
    webhook_type: webhookData.webhook_type,
    webhook_code: webhookData.webhook_code,
    item_id: webhookData.item_id,
  });

  try {
    await dispatch(webhookData, handlers, logger);
  } catch (err) {
    logger.error('Error dispatching webhook handler', err as Error, {
      webhook_type: webhookData.webhook_type,
    });
    return { status: 'error', webhook_type: webhookData.webhook_type };
  }

  logger.info('Webhook processed successfully', {
    webhook_type: webhookData.webhook_type,
  });
  return { status: 'success', webhook_type: webhookData.webhook_type };
}
