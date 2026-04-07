import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { requireStripe } from '../../../../lib/stripe/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events.
 * This route is intentionally NOT protected by the auth middleware
 * (Stripe signs requests with STRIPE_WEBHOOK_SECRET instead).
 *
 * Events handled:
 *   - checkout.session.completed   → subscription activated
 *   - customer.subscription.updated → status change (active/past_due/trialing/etc.)
 *   - customer.subscription.deleted → subscription cancelled
 */
export async function POST(request: NextRequest) {
  const stripe = requireStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set');
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Read raw body — required for signature verification
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', (err as Error).message);
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  console.log(`[stripe/webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const userId = session.metadata?.supabase_user_id;

        if (!userId && !customerId) {
          console.warn('[stripe/webhook] checkout.session.completed: no user ID or customer ID');
          break;
        }

        await syncSubscriptionTier({
          userId: userId ?? null,
          customerId: customerId ?? null,
          subscriptionStatus: 'active',
          tier: 'pro',
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
        const userId = subscription.metadata?.supabase_user_id ?? null;
        const status = subscription.status;

        // Active/trialing → pro; past_due keeps pro (grace period); anything else → free
        const tier = status === 'active' || status === 'trialing' || status === 'past_due' ? 'pro' : 'free';

        await syncSubscriptionTier({
          userId,
          customerId: customerId ?? null,
          subscriptionStatus: status,
          tier,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
        const userId = subscription.metadata?.supabase_user_id ?? null;

        await syncSubscriptionTier({
          userId,
          customerId: customerId ?? null,
          subscriptionStatus: 'canceled',
          tier: 'free',
        });
        break;
      }

      default:
        // Unhandled event type — not an error, just ignore
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] Handler error:', err);
    return Response.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return Response.json({ received: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SyncParams {
  /** Supabase user ID from event metadata (may be null if older sessions) */
  userId: string | null;
  /** Stripe customer ID — used as fallback lookup if userId is missing */
  customerId: string | null;
  /** Raw Stripe subscription status string */
  subscriptionStatus: string;
  /** Resolved tier to write to user_profiles */
  tier: 'pro' | 'free';
}

async function syncSubscriptionTier({
  userId,
  customerId,
  subscriptionStatus,
  tier,
}: SyncParams): Promise<void> {
  if (!supabaseAdmin) {
    console.error('[stripe/webhook] supabaseAdmin is not initialised');
    return;
  }

  const update: Record<string, string | null> = {
    subscription_tier: tier,
    subscription_status: subscriptionStatus,
  };

  // Also store the customer ID if we have it (for future lookups)
  if (customerId) {
    update.stripe_customer_id = customerId;
  }

  if (userId) {
    // Fast path: we know exactly which user to update
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update(update)
      .eq('id', userId);

    if (error) {
      console.error('[stripe/webhook] DB update by userId failed:', error);
    } else {
      console.log(`[stripe/webhook] Updated user ${userId} → tier=${tier}, status=${subscriptionStatus}`);
    }
    return;
  }

  // Fallback: look up by stripe_customer_id
  if (customerId) {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update(update)
      .eq('stripe_customer_id', customerId);

    if (error) {
      console.error('[stripe/webhook] DB update by customerId failed:', error);
    } else {
      console.log(
        `[stripe/webhook] Updated by customerId ${customerId} → tier=${tier}, status=${subscriptionStatus}`
      );
    }
    return;
  }

  console.warn('[stripe/webhook] Cannot sync: no userId or customerId available');
}
