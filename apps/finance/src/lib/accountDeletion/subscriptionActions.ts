import { supabaseAdmin } from "../supabase/admin";
import { stripe } from "../stripe/client";

export type SubscriptionActionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Admin-only: give a user Pro without charging them. Used for comps,
 * team members, or fixing botched billing manually. We only touch our
 * own DB — no fake Stripe subscription is created. A future real
 * Stripe subscription will overwrite these fields via webhook as usual.
 */
export async function grantUserPro(userId: string): Promise<SubscriptionActionResult> {
  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      subscription_tier: "pro",
      subscription_status: "active",
    })
    .eq("id", userId);
  if (error) {
    console.error(`[grantUserPro ${userId}]`, error);
    return { ok: false, status: 400, error: "Failed to grant pro" };
  }
  return { ok: true };
}

/**
 * Admin-only: cancel any active Stripe subscription for the user and
 * drop them to free. Stripe cancellation is best-effort — if it fails
 * (already cancelled / no customer / Stripe outage) we still downgrade
 * the DB so the user loses access immediately. We'd rather reconcile
 * Stripe manually than leave them on pro after an admin clicked revoke.
 */
export async function revokeUserPro(userId: string): Promise<SubscriptionActionResult> {
  try {
    if (stripe) {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();

      if (profile?.stripe_customer_id) {
        const subs = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: "active",
        });
        for (const sub of subs.data) {
          try {
            await stripe.subscriptions.cancel(sub.id);
            console.log(`[revokeUserPro ${userId}] cancelled stripe sub ${sub.id}`);
          } catch (e) {
            console.error(`[revokeUserPro ${userId}] failed to cancel ${sub.id}:`, e);
          }
        }
      }
    }
  } catch (e) {
    console.error(`[revokeUserPro ${userId}] stripe lookup failed (continuing with DB downgrade):`, e);
  }

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "canceled",
    })
    .eq("id", userId);
  if (error) {
    console.error(`[revokeUserPro ${userId}]`, error);
    return { ok: false, status: 400, error: "Failed to revoke pro" };
  }
  return { ok: true };
}
