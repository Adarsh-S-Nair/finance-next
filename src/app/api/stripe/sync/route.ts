import { NextRequest } from 'next/server';
import { requireStripe } from '../../../../lib/stripe/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

/**
 * POST /api/stripe/sync
 *
 * Fallback sync for post-checkout tier update. Called by the settings page
 * when it detects `?upgraded=1` in the URL, in case the Stripe webhook
 * hasn't fired yet (e.g. localhost dev, or webhook delay in production).
 *
 * 1. Looks up the user's stripe_customer_id from user_profiles
 * 2. Calls stripe.subscriptions.list to check for an active subscription
 * 3. If active, updates subscription_tier → 'pro' in Supabase
 * 4. Returns { tier }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
    const stripe = requireStripe();

    if (!supabaseAdmin) {
      return Response.json({ error: 'Supabase admin client not initialised' }, { status: 500 });
    }

    // Fetch the user's current profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, stripe_customer_id, subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[stripe/sync] profile fetch error:', profileError);
      return Response.json({ error: 'Failed to load user profile' }, { status: 500 });
    }

    // If already Pro in DB, nothing to do
    if (profile?.subscription_tier === 'pro') {
      return Response.json({ tier: 'pro' });
    }

    const customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      // No Stripe customer yet — can't sync
      console.log(`[stripe/sync] user ${userId} has no stripe_customer_id, skipping`);
      return Response.json({ tier: profile?.subscription_tier ?? 'free' });
    }

    // Check Stripe for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 5,
    });

    const hasActiveSub = subscriptions.data.length > 0;

    if (hasActiveSub) {
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          subscription_tier: 'pro',
          subscription_status: 'active',
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[stripe/sync] DB update failed:', updateError);
        return Response.json({ error: 'Failed to update subscription tier' }, { status: 500 });
      }

      console.log(`[stripe/sync] Synced user ${userId} → tier=pro`);
      return Response.json({ tier: 'pro' });
    }

    // No active subscription found
    console.log(`[stripe/sync] user ${userId} has no active Stripe subscription`);
    return Response.json({ tier: profile?.subscription_tier ?? 'free' });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[stripe/sync] error:', err);
    return Response.json({ error: (err as Error).message || 'Internal error' }, { status: 500 });
  }
}
