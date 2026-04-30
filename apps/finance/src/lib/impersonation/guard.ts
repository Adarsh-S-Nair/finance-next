import type { NextRequest } from "next/server";
import { supabaseAdmin } from "../supabase/admin";
import { IMPERSONATION_COOKIE_NAME } from "./cookie";

/**
 * Returns a 403 Response if the request is being made inside an active
 * impersonation session, otherwise null. Use as a one-line guard at the
 * top of routes whose blast radius is too large to allow during support
 * sessions: account deletion, Plaid disconnect, Stripe subscription
 * changes, etc.
 *
 * Reading-only or low-blast actions (categorize a transaction, edit a
 * budget) are NOT guarded — being able to see and edit data is the whole
 * point of impersonation.
 *
 *     export const POST = withAuth("foo", async (req, userId) => {
 *       const blocked = await blockedByImpersonation(req);
 *       if (blocked) return blocked;
 *       ...
 *     });
 */
export async function blockedByImpersonation(request: NextRequest): Promise<Response | null> {
  const sessionId = request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const { data: session } = await supabaseAdmin
    .from("impersonation_sessions")
    .select("id, ended_at, consumed_at")
    .eq("id", sessionId)
    .single();

  // Stale cookie (session ended or never consumed) — let the request
  // through. /me would return impersonating: false in this state too.
  if (!session || !session.consumed_at || session.ended_at) return null;

  return Response.json(
    {
      error: "This action is blocked while impersonating. Exit impersonation to perform it.",
    },
    { status: 403 },
  );
}
