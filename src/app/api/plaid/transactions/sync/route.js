/**
 * POST /api/plaid/transactions/sync
 *
 * Thin HTTP wrapper around the transaction sync pipeline. All business logic
 * lives in `src/lib/plaid/transactionSync`. This file is responsible only for:
 *   1. Parsing and validating the request.
 *   2. Resolving the authenticated user id.
 *   3. Dispatching to the pipeline.
 *   4. Formatting the HTTP response (including error shape).
 *
 * See `docs/architectural_patterns.md` for the pattern.
 */

import { requireVerifiedUserId } from '../../../../../lib/api/auth';
import { syncTransactionsForItem } from '../../../../../lib/plaid/transactionSync';

export async function POST(request) {
  let plaidItemId = null;
  try {
    const userId = requireVerifiedUserId(request);
    const body = await request.json();
    plaidItemId = body.plaidItemId ?? null;
    // Truthy check matches legacy behavior — accepts `true`, `"true"`, `1`, etc.
    const forceSync = Boolean(body.forceSync);

    if (!plaidItemId) {
      return Response.json(
        { error: 'Plaid item ID is required' },
        { status: 400 }
      );
    }

    const result = await syncTransactionsForItem({ plaidItemId, userId, forceSync });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error?.httpStatus === 404) {
      return Response.json({ error: error.message || 'Plaid item not found' }, { status: 404 });
    }
    return Response.json(
      { error: 'Failed to sync transactions', details: error?.message },
      { status: 500 }
    );
  }
}
