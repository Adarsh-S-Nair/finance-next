import { NextRequest } from 'next/server';
import { requireStripe } from '../../../../lib/stripe/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

/**
 * POST /api/stripe/portal
 *
 * Opens a Stripe Billing Portal session for the current user so they can
 * manage their subscription (cancel, update payment method, view invoices).
 *
 * Returns { url } — redirect the user to this URL.
 * Requires the user to have a stripe_customer_id already set (i.e., they
 * went through Checkout at least once).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
    const stripe = requireStripe();

    const { data: profile, error: profileError } = await supabaseAdmin!
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[stripe/portal] profile fetch error:', profileError);
      return Response.json({ error: 'Failed to load user profile' }, { status: 500 });
    }

    const customerId = profile?.stripe_customer_id;
    if (!customerId) {
      return Response.json(
        { error: 'No Stripe customer found. Please subscribe first.' },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });

    return Response.json({ url: portalSession.url });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[stripe/portal] error:', err);
    return Response.json({ error: (err as Error).message || 'Internal error' }, { status: 500 });
  }
}
