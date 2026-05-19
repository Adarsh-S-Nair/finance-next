import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { isAllowedAdmin } from "../../../../../lib/admin-allowlist";

/**
 * Returns `{ isAdmin: boolean }` for the currently signed-in user.
 *
 * The decision is made server-side by comparing the auth-derived email
 * against the ADMIN_EMAILS env var — the same source of truth the
 * admin app's proxy uses. The client uses this purely to decide
 * whether to render the Admin shortcut in the sidebar more-menu; it
 * is NOT the gate that actually protects admin.zervo.app.
 *
 * Finance uses Authorization-bearer-token auth on its own API routes
 * (see lib/supabase/client.ts's fetch patch). We accept that token,
 * resolve it to a user via the service-role admin client, then check
 * the user's email against the allowlist.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;

  if (!token) {
    return NextResponse.json({ isAdmin: false });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.email) {
      return NextResponse.json({ isAdmin: false });
    }
    return NextResponse.json({ isAdmin: isAllowedAdmin(data.user.email) });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
