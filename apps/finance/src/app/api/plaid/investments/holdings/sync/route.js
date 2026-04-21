/**
 * POST /api/plaid/investments/holdings/sync
 *
 * Thin HTTP wrapper around the holdings sync pipeline. All business
 * logic lives in `src/lib/plaid/holdingsSync`. This file is responsible
 * only for:
 *   1. Parsing and validating the request.
 *   2. Resolving the authenticated user id.
 *   3. Dispatching to the pipeline.
 *   4. Formatting the HTTP response, including the 403 tier-gate and
 *      404 missing-item responses.
 *
 * See `docs/architectural_patterns.md` for the pattern.
 */

import { requireVerifiedUserId } from '../../../../../../lib/api/auth';
import { syncHoldingsForItem } from '../../../../../../lib/plaid/holdingsSync';

export async function POST(request) {
  let plaidItemId = null;
  try {
    const userId = requireVerifiedUserId(request);
    const body = await request.json();
    plaidItemId = body.plaidItemId ?? null;
    const includeDebug = Boolean(body.includeDebug);
    const forceSync = Boolean(body.forceSync);

    if (!plaidItemId) {
      return Response.json(
        { error: 'Plaid item ID is required' },
        { status: 400 }
      );
    }

    const result = await syncHoldingsForItem({
      plaidItemId,
      userId,
      forceSync,
      includeDebug,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    // HoldingsSyncError carries an httpStatus; map it to the matching response.
    if (error?.httpStatus === 403) {
      return Response.json(
        { error: error.message, code: error.code, feature: error.feature },
        { status: 403 }
      );
    }
    if (error?.httpStatus === 404) {
      return Response.json(
        { error: error.message || 'Plaid item not found' },
        { status: 404 }
      );
    }
    console.error('Failed to sync holdings:', error);
    return Response.json(
      { error: 'Failed to sync holdings' },
      { status: 500 }
    );
  }
}
