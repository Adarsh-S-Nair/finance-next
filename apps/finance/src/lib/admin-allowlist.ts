/**
 * Admin allowlist check, mirroring apps/admin/src/lib/auth/admin.ts.
 *
 * Used here (in the finance app) only to decide whether to render the
 * "Admin" link in the sidebar more-menu — it is NOT the gate that
 * actually protects admin.zervo.app. That gate lives in the admin
 * app's proxy and uses the same env var; lying to this check just
 * means a user sees a link that routes them to an unauthorized page.
 *
 * The ADMIN_EMAILS env var should hold the SAME value here as on the
 * admin Vercel project so the menu visibility and the actual access
 * decision agree.
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
  return getAllowlist().has(email.toLowerCase());
}
