import { requireStripe } from '../../../../lib/stripe/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';

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
export const POST = withAuth('stripe:portal', async (_request, userId) => {
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

    // Resolve the return URL from the server-configured env var only.
    // Previously this fell back to the client-controlled `Origin` header,
    // which was an open-redirect vector: an attacker could spoof `Origin`
    // and Stripe would redirect the user back onto an attacker-controlled
    // domain after the portal session.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error('[stripe/portal] NEXT_PUBLIC_APP_URL is not configured');
      return Response.json(
        { error: 'Service misconfigured', message: 'App URL not set' },
        { status: 503 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`,
    });

    return Response.json({ url: portalSession.url });
});
