import { NextRequest } from 'next/server';
// @ts-ignore — cron.js is a plain JS module with no type declarations
import { verifyCronSecret } from '../../../../lib/api/cron';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * GET /api/cron/downgrade-lapsed-pro
 *
 * Safety net for the `past_due` → Pro-forever edge case.
 *
 * When Stripe reports a subscription as `past_due` we keep the user on Pro
 * (grace period) and stamp `user_profiles.past_due_since`. In the happy
 * path Stripe's dunning sequence eventually resolves the sub (either to
 * `active` after a successful retry or to `canceled`/`unpaid` after final
 * failure) and the matching webhook updates our DB.
 *
 * This cron exists because we don't fully trust that sequence:
 *   - Stripe dunning might not be configured for the account.
 *   - A webhook might be dropped and never re-delivered successfully.
 *   - A user might remain `past_due` indefinitely if retry settings allow.
 *
 * On each run we find every user with `past_due_since` older than the
 * grace window AND still on `tier=pro`, then flip them to `free`.
 *
 * Gated by CRON_SECRET. Scheduled from vercel.json.
 */

const GRACE_PERIOD_DAYS = 14;

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  if (!supabaseAdmin) {
    return Response.json(
      { error: 'Supabase admin client not initialised' },
      { status: 500 }
    );
  }

  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: lapsed, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, past_due_since, subscription_tier, subscription_status')
    .eq('subscription_tier', 'pro')
    .lt('past_due_since', cutoff);

  if (error) {
    console.error('[cron/downgrade-lapsed-pro] lookup failed:', error);
    return Response.json({ error: 'Lookup failed' }, { status: 500 });
  }

  if (!lapsed || lapsed.length === 0) {
    return Response.json({ ok: true, downgraded: 0, graceDays: GRACE_PERIOD_DAYS });
  }

  console.log(
    `[cron/downgrade-lapsed-pro] downgrading ${lapsed.length} user(s) past the ${GRACE_PERIOD_DAYS}-day grace window`
  );

  const ids = lapsed.map((u: { id: string }) => u.id);
  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      subscription_tier: 'free',
      // Leave subscription_status as-is so the admin/support view can still
      // see the last Stripe-reported state. Clear past_due_since so the
      // downgrade stays sticky; a real `customer.subscription.updated` with
      // status=active will re-enter via the webhook and flip back to pro.
      past_due_since: null,
    })
    .in('id', ids);

  if (updateError) {
    console.error('[cron/downgrade-lapsed-pro] downgrade update failed:', updateError);
    return Response.json({ error: 'Downgrade update failed' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    downgraded: ids.length,
    graceDays: GRACE_PERIOD_DAYS,
    userIds: ids,
  });
}
