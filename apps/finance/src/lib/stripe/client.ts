import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const createStripeClient = (): Stripe | null => {
  if (!stripeSecretKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[stripe] STRIPE_SECRET_KEY is not set — Stripe features will be unavailable');
    }
    return null;
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2026-03-25.dahlia',
  });
};

// Singleton — reuse across hot-module-reload in dev
const globalForStripe = global as typeof globalThis & { stripe?: Stripe | null };

export const stripe: Stripe | null =
  globalForStripe.stripe !== undefined ? globalForStripe.stripe : (globalForStripe.stripe = createStripeClient());

/**
 * Returns a Stripe client or throws a clear error.
 * Use inside route handlers that require Stripe to be configured.
 */
export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
  }
  return stripe;
}
