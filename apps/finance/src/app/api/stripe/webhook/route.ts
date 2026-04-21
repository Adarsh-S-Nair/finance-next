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

        const userId = session.metadata?.supabase_user_id;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

        // Fail closed if supabase_user_id is missing. The checkout route
        // always sets this on both the session and subscription_data, so
        // its absence means either (a) a legacy subscription that was
        // created before that code shipped, or (b) a malformed/forged event.
        // Either way, falling back to a stripe_customer_id lookup is a
        // tier-spoofing vector — another user could be upgraded if the
        // customerId was ever reused, guessed, or deliberately injected.
        if (!userId) {
          console.error('[stripe/webhook] checkout.session.completed missing supabase_user_id metadata', {
            eventId: event.id,
            sessionId: session.id,
            customerId,
          });
          return Response.json(
            { error: 'Missing supabase_user_id in session metadata' },
            { status: 400 }
          );
        }

        await syncSubscriptionTier({
          userId,
          customerId,
          subscriptionStatus: 'active',
          tier: 'pro',
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id ?? null;

        if (!userId) {
          console.error('[stripe/webhook] customer.subscription.updated missing supabase_user_id metadata', {
            eventId: event.id,
            subscriptionId: subscription.id,
            customerId,
          });
          return Response.json(
            { error: 'Missing supabase_user_id in subscription metadata' },
            { status: 400 }
          );
        }

        const status = subscription.status;
        // Active/trialing → pro; past_due keeps pro (grace period); anything else → free
        const tier = status === 'active' || status === 'trialing' || status === 'past_due' ? 'pro' : 'free';

        await syncSubscriptionTier({
          userId,
          customerId,
          subscriptionStatus: status,
          tier,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id ?? null;

        if (!userId) {
          console.error('[stripe/webhook] customer.subscription.deleted missing supabase_user_id metadata', {
            eventId: event.id,
            subscriptionId: subscription.id,
            customerId,
          });
          return Response.json(
            { error: 'Missing supabase_user_id in subscription metadata' },
            { status: 400 }
          );
        }

        await syncSubscriptionTier({
          userId,
          customerId,
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
  /** Supabase user ID from event metadata. Required — callers validate upstream. */
  userId: string;
  /** Stripe customer ID — persisted alongside the tier update for future reference. */
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

  // Also store the customer ID if we have it (for future reference)
  if (customerId) {
    update.stripe_customer_id = customerId;
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(update)
    .eq('id', userId);

  if (error) {
    console.error('[stripe/webhook] DB update by userId failed:', error);
  } else {
    console.log(`[stripe/webhook] Updated user ${userId} → tier=${tier}, status=${subscriptionStatus}`);
  }
}
