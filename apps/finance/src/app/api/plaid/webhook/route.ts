/**
 * POST /api/plaid/webhook
 *
 * Thin HTTP wrapper around the Plaid webhook pipeline. All business
 * logic — signature verification, payload parsing, event-type dispatch,
 * and the per-event-type handlers — lives in `src/lib/plaid/webhooks`.
 *
 * The route is responsible only for:
 *   1. The `DISABLE_WEBHOOKS` dev bypass.
 *   2. Reading the raw payload + `Plaid-Verification` header.
 *   3. Creating a correlation-ID-scoped logger and timing the operation.
 *   4. Dispatching to `processPlaidWebhook` and mapping its result to
 *      an HTTP response.
 *
 * Plaid webhooks are unauthenticated — the signature check inside
 * `processPlaidWebhook` is what proves authenticity. This route is on
 * the middleware PUBLIC_ROUTES allowlist for that reason.
 *
 * See `docs/architectural_patterns.md`.
 */

import type { NextRequest } from 'next/server';
import { createLogger } from '../../../../lib/logger';
import { processPlaidWebhook } from '../../../../lib/plaid/webhooks';

const DISABLE_WEBHOOKS =
  process.env.NODE_ENV !== 'production' && process.env.DISABLE_WEBHOOKS === '1';

export async function POST(request: NextRequest): Promise<Response> {
  // Request-specific logger with a unique correlation ID so all child
  // handlers for this webhook thread through the same log trail.
  const logger = createLogger('plaid-webhook');
  const opId = logger.startOperation('webhook-processing');

  try {
    if (DISABLE_WEBHOOKS) {
      logger.info('Webhook disabled in development mode');
      logger.endOperation(opId, { status: 'disabled' });
      await logger.flush();
      return Response.json({ received: true, disabled: true });
    }

    const payload = await request.text();
    const signature =
      request.headers.get('plaid-verification') ||
      request.headers.get('Plaid-Verification') ||
      null;

    const result = await processPlaidWebhook({ payload, signature }, { logger });

    logger.endOperation(opId, result as unknown as Record<string, unknown>);
    await logger.flush();

    if (result.status === 'invalid_signature') {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    if (result.status === 'parse_error') {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (result.status === 'error') {
      return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

    return Response.json({ received: true, disabled: result.status === 'disabled' });
  } catch (error) {
    logger.error('Unexpected error in webhook route', error as Error);
    logger.endOperation(opId, { status: 'error' });
    await logger.flush();
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
