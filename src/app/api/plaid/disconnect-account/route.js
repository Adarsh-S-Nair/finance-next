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

import { requireVerifiedUserId } from '../../../../lib/api/auth';
import {
  disconnectAccount,
  DisconnectError,
} from '../../../../lib/plaid/disconnectAccount';

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { accountId } = await request.json();

    if (!accountId) {
      return Response.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    const result = await disconnectAccount({ accountId, userId });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof DisconnectError) {
      return Response.json(
        { error: error.message, details: error.details },
        { status: error.httpStatus }
      );
    }
    console.error('Unexpected error in disconnect-account:', error);
    return Response.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}
