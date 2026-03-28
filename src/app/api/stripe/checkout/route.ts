import { NextRequest } from 'next/server';
import { requireStripe } from '../../../../lib/stripe/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the Pro monthly plan.
 * Returns { url } — redirect the user to this URL.
 *
 * - Looks up (or creates) a Stripe customer for the user.
 * - Stores the stripe_customer_id on the user_profiles row so we can
 *   match webhook events back to the right user.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
    const stripe = requireStripe();

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      return Response.json({ error: 'STRIPE_PRO_PRICE_ID is not configured' }, { status: 500 });
    }

    // Fetch the user's current profile to get email + existing customer ID
    const { data: profile, error: profileError } = await supabaseAdmin!
      .from('user_profiles')
      .select('id, stripe_customer_id, subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[stripe/checkout] profile fetch error:', profileError);
      return Response.json({ error: 'Failed to load user profile' }, { status: 500 });
    }

    // If already Pro, no need to create a new checkout session
    if (profile?.subscription_tier === 'pro') {
      return Response.json({ error: 'Already on Pro plan' }, { status: 400 });
    }

    // Get email from Supabase auth
    const { data: authUser } = await supabaseAdmin!.auth.admin.getUserById(userId);
    const email = authUser?.user?.email ?? undefined;

    // Find or create Stripe customer
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      // Persist immediately so webhook can always resolve the user.
      // Use upsert so it creates the profile row if it doesn't exist yet.
      const { error: updateError } = await supabaseAdmin!
        .from('user_profiles')
        .upsert({ id: userId, stripe_customer_id: customerId }, { onConflict: 'id' });

      if (updateError) {
        console.error('[stripe/checkout] failed to save customer ID:', updateError);
        // Non-fatal — continue, webhook will still carry user_id in metadata
      }
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?upgraded=1`,
      cancel_url: `${origin}/settings`,
      metadata: { supabase_user_id: userId },
      subscription_data: {
        metadata: { supabase_user_id: userId },
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[stripe/checkout] error:', err);
    return Response.json({ error: (err as Error).message || 'Internal error' }, { status: 500 });
  }
}
