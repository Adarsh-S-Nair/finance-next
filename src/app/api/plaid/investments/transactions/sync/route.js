/**
 * POST /api/plaid/investments/transactions/sync
 *
 * Thin HTTP wrapper around the investment transaction sync pipeline. All
 * business logic lives in `src/lib/plaid/investmentTransactionSync`. This
 * file is responsible only for:
 *   1. Parsing and validating the request.
 *   2. Resolving the authenticated user id.
 *   3. Checking the Pro tier gate (investments is a paid feature).
 *   4. Dispatching to the pipeline.
 *   5. Formatting the HTTP response (including error shape).
 *
 * See `docs/architectural_patterns.md` for the pattern.
 */

import { supabaseAdmin } from '../../../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../../../lib/api/auth';
import { canAccess } from '../../../../../../lib/tierConfig';
import { syncInvestmentTransactionsForItem } from '../../../../../../lib/plaid/investmentTransactionSync';

export async function POST(request) {
  let plaidItemId = null;
  try {
    const userId = requireVerifiedUserId(request);
    const body = await request.json();
    plaidItemId = body.plaidItemId ?? null;
    const forceSync = Boolean(body.forceSync);

    if (!plaidItemId) {
      return Response.json(
        { error: 'Plaid item ID is required' },
        { status: 400 }
      );
    }

    // Tier gate: investments is a Pro feature
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    if (!canAccess(userProfile?.subscription_tier || 'free', 'investments')) {
      return Response.json({ error: 'feature_locked', feature: 'investments' }, { status: 403 });
    }

    const result = await syncInvestmentTransactionsForItem({ plaidItemId, userId, forceSync });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error?.httpStatus === 404) {
      return Response.json({ error: error.message || 'Plaid item not found' }, { status: 404 });
    }
    console.error('Failed to sync investment transactions:', error);
    return Response.json(
      { error: 'Failed to sync investment transactions' },
      { status: 500 }
    );
  }
}
