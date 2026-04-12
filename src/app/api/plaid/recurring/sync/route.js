/**
 * POST /api/plaid/recurring/sync
 *
 * Thin HTTP wrapper around the recurring transactions sync pipeline. All
 * business logic lives in `src/lib/plaid/recurringSync`. This file is
 * responsible only for:
 *   1. Parsing and validating the request.
 *   2. Resolving the authenticated user id.
 *   3. Checking the Pro tier gate (recurring is a paid feature).
 *   4. Dispatching to the pipeline.
 *   5. Formatting the HTTP response (including error shape).
 *
 * See `docs/architectural_patterns.md` for the pattern.
 */

import { supabaseAdmin } from '../../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../../lib/api/auth';
import { canAccess } from '../../../../../lib/tierConfig';
import { syncRecurringForUser } from '../../../../../lib/plaid/recurringSync';

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const body = await request.json();
    const forceReset = Boolean(body.forceReset);
    const plaidItemId = body.plaidItemId ?? null;

    // Tier gate: recurring is a Pro feature
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    if (!canAccess(userProfile?.subscription_tier || 'free', 'recurring')) {
      return Response.json({ error: 'feature_locked', feature: 'recurring' }, { status: 403 });
    }

    const result = await syncRecurringForUser({ userId, forceReset, plaidItemId });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { error: 'Failed to sync recurring transactions', details: error?.message },
      { status: 500 }
    );
  }
}
