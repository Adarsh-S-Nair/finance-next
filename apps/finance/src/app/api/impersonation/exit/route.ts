import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { IMPERSONATION_COOKIE_NAME } from "../../../../lib/impersonation/cookie";

/**
 * Admin clicks "Exit impersonation" → mark session ended and clear the
 * cookie. The Supabase session itself is invalidated client-side (signOut)
 * so the tab can't continue making requests as the target.
 */
export const POST = withAuth("impersonation:exit", async (req: NextRequest, callerId) => {
  const sessionId = req.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;

  if (sessionId) {
    const { data: session } = await supabaseAdmin
      .from("impersonation_sessions")
      .select("id, target_user_id, ended_at")
      .eq("id", sessionId)
      .single();

    // Only end the session if it actually belongs to this tab. If the
    // cookie is stale (different target signed in here later), ignore.
    if (session && session.target_user_id === callerId && !session.ended_at) {
      await supabaseAdmin
        .from("impersonation_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(IMPERSONATION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
});
