import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { IMPERSONATION_COOKIE_NAME } from "../../../../lib/impersonation/cookie";

/**
 * Returns the current impersonation context (if any) for the requesting
 * tab. Validates that:
 *   - the cookie session_id maps to an unended, consumed session
 *   - target_user_id matches the bearer token's user (otherwise the cookie
 *     is stale from a prior impersonation and we ignore it)
 *   - the underlying grant is still approved + unexpired
 *
 * Banner mounts call this on every page load to decide whether to render
 * the red "you're impersonating" bar.
 */
export const GET = withAuth("impersonation:me", async (req: NextRequest, callerId) => {
  const sessionId = req.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ impersonating: false });
  }

  const { data: session } = await supabaseAdmin
    .from("impersonation_sessions")
    .select("id, target_user_id, requester_id, ended_at, consumed_at, grant_id, started_at")
    .eq("id", sessionId)
    .single();

  if (!session || session.target_user_id !== callerId) {
    return NextResponse.json({ impersonating: false });
  }
  if (!session.consumed_at || session.ended_at) {
    return NextResponse.json({ impersonating: false });
  }

  const { data: grant } = await supabaseAdmin
    .from("impersonation_grants")
    .select("status, expires_at")
    .eq("id", session.grant_id)
    .single();
  if (
    !grant ||
    grant.status !== "approved" ||
    !grant.expires_at ||
    new Date(grant.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ impersonating: false });
  }

  const { data: requester } = await supabaseAdmin.auth.admin.getUserById(session.requester_id);

  return NextResponse.json({
    impersonating: true,
    session_id: session.id,
    requester_email: requester?.user?.email ?? null,
    expires_at: grant.expires_at,
    started_at: session.started_at,
  });
});
