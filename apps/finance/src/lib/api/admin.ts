import { supabaseAdmin } from "../supabase/admin";

/**
 * Comma-separated allowlist of admin emails. The same env var is read by
 * the admin subdomain's middleware, so both apps share one source of truth
 * for who counts as an admin. Keeping this out of the DB means someone
 * with DB write access can't self-promote.
 */
function getAdminAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminAllowlist().has(email.toLowerCase());
}

/**
 * Look up the caller's email via the service-role client and check it
 * against ADMIN_EMAILS. Returns `true` if allowed, `false` otherwise.
 * Uses the service-role client because the caller's anon-key client
 * can't read auth.users.email for anyone but themselves.
 */
export async function isCallerAdmin(callerUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(callerUserId);
    if (error || !data?.user?.email) return false;
    return isAllowedAdmin(data.user.email);
  } catch (e) {
    console.error("[isCallerAdmin] failed to resolve caller email:", e);
    return false;
  }
}
