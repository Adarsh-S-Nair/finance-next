/**
 * POST /api/plaid/disconnect-account
 *
 * Thin HTTP wrapper around the account-disconnect pipeline. All business
 * logic — cascade-delete ordering, race-safe remaining-count check, Plaid
 * /item/remove handling, dead-item error classification — lives in
 * `src/lib/plaid/disconnectAccount`.
 *
 * See `docs/architectural_patterns.md` for the pattern.
 */

import { withAuth } from '../../../../lib/api/withAuth';
import {
  disconnectAccount,
  DisconnectError,
} from '../../../../lib/plaid/disconnectAccount';

export const POST = withAuth('plaid:disconnect-account', async (request, userId) => {
  const { accountId } = await request.json();

  if (!accountId) {
    return Response.json({ error: 'Account ID is required' }, { status: 400 });
  }

  try {
    const result = await disconnectAccount({ accountId, userId });
    return Response.json(result);
  } catch (error) {
    if (error instanceof DisconnectError) {
      return Response.json(
        { error: error.message, details: error.details },
        { status: error.httpStatus },
      );
    }
    throw error;
  }
});
