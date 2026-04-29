/**
 * POST /api/plaid/liabilities/sync
 *
 * Thin HTTP wrapper around the liabilities sync pipeline. Manual refresh
 * endpoint — the post-link sync is fired automatically from the
 * exchange-token after() callback via the sync runner registry.
 */

import { withAuth } from '../../../../../lib/api/withAuth';
import {
  syncLiabilitiesForItem,
  LiabilitiesSyncError,
} from '../../../../../lib/plaid/liabilitiesSync';

interface RequestBody {
  plaidItemId?: string | null;
}

export const POST = withAuth('plaid:liabilities:sync', async (request, userId) => {
  const body = (await request.json()) as RequestBody;
  const plaidItemId = body.plaidItemId ?? null;

  if (!plaidItemId) {
    return Response.json({ error: 'Plaid item ID is required' }, { status: 400 });
  }

  try {
    const result = await syncLiabilitiesForItem({ plaidItemId, userId });
    return Response.json(result);
  } catch (error) {
    if (error instanceof LiabilitiesSyncError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus },
      );
    }
    console.error('Liabilities sync failed', error);
    return Response.json({ error: 'Liabilities sync failed' }, { status: 500 });
  }
});
