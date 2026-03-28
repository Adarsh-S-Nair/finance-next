import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

/**
 * POST /api/subscription/upgrade
 * Sets subscription_tier to 'pro' for the authenticated user.
 * Only available in non-production / mock mode.
 */
export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);

    // Guard: only works in non-production or mock Plaid environment
    const isProduction = process.env.NODE_ENV === 'production';
    const isMock = process.env.PLAID_ENV === 'mock';

    if (isProduction && !isMock) {
      return Response.json(
        { error: 'Stripe not configured yet' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ subscription_tier: 'pro' })
      .eq('id', userId);

    if (error) {
      console.error('[subscription/upgrade] DB error:', error);
      return Response.json({ error: 'Failed to upgrade subscription' }, { status: 500 });
    }

    return Response.json({ success: true, subscription_tier: 'pro' });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[subscription/upgrade] error:', err);
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
