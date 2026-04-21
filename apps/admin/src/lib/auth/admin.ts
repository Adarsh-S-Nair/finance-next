/**
 * Admin allowlist check. The ADMIN_EMAILS env var holds a comma-separated
 * list of email addresses permitted to access the admin dashboard.
 *
 * This is the sole gate. There is no "admin" flag in the database — we keep
 * the allowlist in infrastructure config so it can't be escalated by anyone
 * with DB write access.
 */

function getAllowlist(): Set<string> {
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
  const allowed = getAllowlist();
  return allowed.has(email.toLowerCase());
}
