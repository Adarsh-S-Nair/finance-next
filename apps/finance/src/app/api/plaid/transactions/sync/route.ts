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

import { withAuth } from '../../../../../lib/api/withAuth';
import { syncTransactionsForItem } from '../../../../../lib/plaid/transactionSync';

interface RequestBody {
  plaidItemId?: string | null;
  forceSync?: boolean;
}

export const POST = withAuth('plaid:transactions:sync', async (request, userId) => {
  const body = (await request.json()) as RequestBody;
  const plaidItemId = body.plaidItemId ?? null;
  const forceSync = Boolean(body.forceSync);

  if (!plaidItemId) {
    return Response.json({ error: 'Plaid item ID is required' }, { status: 400 });
  }

  try {
    const result = await syncTransactionsForItem({ plaidItemId, userId, forceSync });
    return Response.json(result);
  } catch (error) {
    const err = error as { httpStatus?: number; message?: string };
    if (err?.httpStatus === 404) {
      return Response.json({ error: err.message || 'Plaid item not found' }, { status: 404 });
    }
    throw error;
  }
});
