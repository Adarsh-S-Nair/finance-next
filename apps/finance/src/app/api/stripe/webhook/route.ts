import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { requireStripe } from '../../../../lib/stripe/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events.
 *
 * This route is intentionally NOT protected by the auth middleware — Stripe
 * signs the request body with `STRIPE_WEBHOOK_SECRET` and we verify that
 * before trusting anything in the payload.
 *
 * Defensive properties (important — this endpoint handles money):
 *
 *   1. Idempotent. Every event.id is claimed in `stripe_processed_events`
 *      before processing. If Stripe retries an event we've already handled,
 *      the insert conflicts and we return 200 immediately. Prevents
 *      double-applying non-idempotent side effects that we might add later
 *      (credits, emails, analytics).
 *
 *   2. Safe user resolution. We prefer `metadata.supabase_user_id` (set by
 *      our checkout route) but fall back to the `stripe_customer_id`
 *      lookup in `user_profiles`. The fallback is safe because:
 *        - stripe_customer_id is Stripe-generated, not client-supplied
 *        - we only stored it when WE created the customer
 *        - there's a unique constraint on the column
 *      If neither identifier resolves a user (legacy subs, Stripe-dashboard
 *      comps we don't know about), we log and return 200 so Stripe doesn't
 *      retry forever.
 *
 *   3. Pro-price gating. We only flip a user to Pro when the subscription
 *      is for `STRIPE_PRO_PRICE_ID`. Prevents accidentally granting Pro if
 *      we ever add a different product to the same customer.
 *
 *   4. `past_due` safety net. When Stripe reports past_due we stamp
 *      `past_due_since`. A cron (`/api/cron/downgrade-lapsed-pro`) sweeps
 *      users stuck there past the grace window so they can't stay Pro
 *      indefinitely if Stripe dunning isn't configured.
 *
 * Events handled:
 *   - checkout.session.completed    → confirm status + flip to Pro
 *   - customer.subscription.created → mirror status (covers dashboard comps)
 *   - customer.subscription.updated → mirror status + past_due stamping
 *   - customer.subscription.deleted → flip to free, clear past_due
 *   - invoice.payment_failed        → stamp past_due_since (if unset)
 *   - invoice.payment_succeeded     → clear past_due_since
 */

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? null;

export async function POST(request: NextRequest) {
  const stripe = requireStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set');
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

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

  // Claim the event ID before doing any work. If another replica (or a
  // Stripe retry) has already processed this event, the insert fails on
  // the primary-key conflict and we bail.
  const claimed = await claimEvent(event.id, event.type);
  if (claimed === 'already_processed') {
    console.log(`[stripe/webhook] Event ${event.id} already processed, skipping`);
    return Response.json({ received: true, deduped: true });
  }
  if (claimed === 'error') {
    // Claim DB write failed (DB down, table missing, etc.). Return 500 so
    // Stripe retries — better than silently dropping.
    return Response.json({ error: 'Failed to claim event for processing' }, { status: 500 });
  }

  console.log(`[stripe/webhook] Received event: ${event.type} (${event.id})`);

  try {
    await dispatchEvent(event, stripe);
  } catch (err) {
    console.error('[stripe/webhook] Handler error:', err);
    // Release the claim so Stripe's retry can re-process this event.
    await releaseClaim(event.id);
    return Response.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return Response.json({ received: true });
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function dispatchEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpserted(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    default:
      // Unhandled event type — not an error, just ignore.
      break;
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  if (session.mode !== 'subscription') return;

  const customerId = extractCustomerId(session.customer);
  const userId = await resolveUserId({
    metadataUserId: session.metadata?.supabase_user_id,
    customerId,
    eventLabel: `checkout.session.completed(${session.id})`,
  });
  if (!userId) return;

  // Read the REAL subscription status rather than hardcoding 'active'. If
  // checkout finalized with an incomplete subscription (e.g. 3DS challenge
  // failure mid-finalization) we must not flip to Pro.
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  let status = 'active';
  let priceId: string | null = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = sub.status;
      priceId = sub.items.data[0]?.price?.id ?? null;
    } catch (err) {
      console.error(`[stripe/webhook] Failed to retrieve subscription ${subscriptionId}:`, err);
    }
  }

  const isActive = status === 'active' || status === 'trialing';
  const tier = isActive && matchesProPrice(priceId) ? 'pro' : 'free';

  await updateUserSubscription({
    userId,
    customerId,
    subscriptionStatus: status,
    tier,
    pastDueSince: 'clear',
  });
}

async function handleSubscriptionUpserted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = extractCustomerId(subscription.customer);
  const userId = await resolveUserId({
    metadataUserId: subscription.metadata?.supabase_user_id,
    customerId,
    eventLabel: `customer.subscription.created|updated(${subscription.id})`,
  });
  if (!userId) return;

  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const isProPrice = matchesProPrice(priceId);
  const isActive = status === 'active' || status === 'trialing';
  const isPastDue = status === 'past_due';

  // active/trialing keeps Pro. past_due keeps Pro but we stamp past_due_since
  // so the cron can downgrade after the grace window. Anything else → free.
  const tier = isProPrice && (isActive || isPastDue) ? 'pro' : 'free';

  await updateUserSubscription({
    userId,
    customerId,
    subscriptionStatus: status,
    tier,
    pastDueSince: isPastDue ? 'set_if_null' : 'clear',
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = extractCustomerId(subscription.customer);
  const userId = await resolveUserId({
    metadataUserId: subscription.metadata?.supabase_user_id,
    customerId,
    eventLabel: `customer.subscription.deleted(${subscription.id})`,
  });
  if (!userId) return;

  await updateUserSubscription({
    userId,
    customerId,
    subscriptionStatus: subscription.status, // usually 'canceled'
    tier: 'free',
    pastDueSince: 'clear',
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = extractCustomerId(invoice.customer);
  // Invoices don't carry metadata.supabase_user_id; resolve via customer only.
  const userId = await resolveUserId({
    metadataUserId: null,
    customerId,
    eventLabel: `invoice.payment_failed(${invoice.id})`,
  });
  if (!userId) return;

  await stampPastDueIfNull(userId);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const customerId = extractCustomerId(invoice.customer);
  const userId = await resolveUserId({
    metadataUserId: null,
    customerId,
    eventLabel: `invoice.payment_succeeded(${invoice.id})`,
  });
  if (!userId) return;

  await clearPastDue(userId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractCustomerId(
  customer: string | { id?: string } | null | undefined
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id ?? null;
}

function matchesProPrice(priceId: string | null): boolean {
  // If no PRO_PRICE_ID is configured, preserve legacy behavior (any active
  // sub qualifies). In prod we expect this env var to be set — if it's
  // missing we log a warning so the misconfiguration is visible.
  if (!PRO_PRICE_ID) {
    console.warn('[stripe/webhook] STRIPE_PRO_PRICE_ID not set — accepting any price');
    return true;
  }
  return priceId === PRO_PRICE_ID;
}

async function claimEvent(
  eventId: string,
  eventType: string
): Promise<'claimed' | 'already_processed' | 'error'> {
  if (!supabaseAdmin) return 'error';
  const { error } = await supabaseAdmin
    .from('stripe_processed_events')
    .insert({ event_id: eventId, event_type: eventType });
  if (!error) return 'claimed';
  if (error.code === '23505') return 'already_processed'; // unique_violation
  console.error('[stripe/webhook] Failed to claim event:', error);
  return 'error';
}

async function releaseClaim(eventId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('stripe_processed_events')
    .delete()
    .eq('event_id', eventId);
  if (error) {
    console.error(`[stripe/webhook] Failed to release claim for ${eventId}:`, error);
  }
}

async function resolveUserId(params: {
  metadataUserId: string | null | undefined;
  customerId: string | null;
  eventLabel: string;
}): Promise<string | null> {
  const { metadataUserId, customerId, eventLabel } = params;
  if (metadataUserId) return metadataUserId;

  if (!customerId || !supabaseAdmin) {
    console.warn(`[stripe/webhook] ${eventLabel}: no metadata and no customerId — log-and-ignore`);
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (error) {
    console.error(`[stripe/webhook] ${eventLabel}: customer_id lookup failed:`, error);
    return null;
  }
  if (!data) {
    console.warn(
      `[stripe/webhook] ${eventLabel}: no user has stripe_customer_id=${customerId} — log-and-ignore`
    );
    return null;
  }
  return data.id;
}

interface UpdateParams {
  userId: string;
  customerId: string | null;
  subscriptionStatus: string;
  tier: 'pro' | 'free';
  /**
   * How to treat `past_due_since`:
   *   - 'set_if_null' → only stamp if currently null (preserve the original
   *     transition timestamp across multiple past_due updates)
   *   - 'clear' → null it out (payment recovered or sub canceled)
   */
  pastDueSince: 'set_if_null' | 'clear';
}

async function updateUserSubscription(params: UpdateParams): Promise<void> {
  if (!supabaseAdmin) {
    console.error('[stripe/webhook] supabaseAdmin is not initialised');
    return;
  }

  const update: Record<string, unknown> = {
    subscription_tier: params.tier,
    subscription_status: params.subscriptionStatus,
  };
  if (params.customerId) update.stripe_customer_id = params.customerId;
  if (params.pastDueSince === 'clear') update.past_due_since = null;

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(update)
    .eq('id', params.userId);

  if (error) {
    console.error('[stripe/webhook] user_profiles update failed:', error);
    return;
  }

  if (params.pastDueSince === 'set_if_null') {
    await stampPastDueIfNull(params.userId);
  }

  console.log(
    `[stripe/webhook] user ${params.userId} → tier=${params.tier}, status=${params.subscriptionStatus}`
  );
}

async function stampPastDueIfNull(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  // Read first so we preserve the original transition timestamp across
  // multiple past_due events. We could do this in one UPDATE with a WHERE
  // clause, but the Supabase JS client can't easily express "update WHERE
  // past_due_since IS NULL AND id = ?" in a single call.
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('past_due_since')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[stripe/webhook] past_due_since lookup failed:', error);
    return;
  }
  if (data?.past_due_since) return;

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ past_due_since: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    console.error('[stripe/webhook] past_due_since stamp failed:', updateError);
  }
}

async function clearPastDue(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ past_due_since: null })
    .eq('id', userId);
  if (error) {
    console.error('[stripe/webhook] past_due_since clear failed:', error);
  }
}
