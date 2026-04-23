import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Bumps user_profiles.last_active_at for the authenticated user.
 *
 * Server-side throttle: only writes if the existing value is older than
 * 5 minutes, so even if a client floods this endpoint we issue at most
 * one UPDATE per user per 5 minutes. The client throttle in
 * UserProvider is the cheap path that avoids the round-trip entirely.
 */
export const POST = withAuth('heartbeat', async (_request, userId) => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
    .or(`last_active_at.is.null,last_active_at.lt.${cutoff}`);

  if (error) {
    console.error('[heartbeat] update failed', error);
    return Response.json({ error: 'Heartbeat failed' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
});
