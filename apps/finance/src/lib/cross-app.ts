/**
 * Cross-app URL constants and helpers for the SSO handoff between
 * zervo.app (this app) and the admin / developer subdomains.
 *
 * Each consumer reads URLs from `NEXT_PUBLIC_*` env vars so local dev
 * can override them (e.g. http://localhost:3001 for admin during dev),
 * but defaults to prod so most setups need zero env config.
 */

export const ZERVO_ADMIN_URL =
  process.env.NEXT_PUBLIC_ZERVO_ADMIN_URL ?? "https://admin.zervo.app";

export const ZERVO_DEVELOPER_URL =
  process.env.NEXT_PUBLIC_ZERVO_DEVELOPER_URL ?? "https://developer.zervo.app";

const KNOWN_HOSTS = new Set(
  [ZERVO_ADMIN_URL, ZERVO_DEVELOPER_URL]
    .map((u) => safeHost(u))
    .filter((h): h is string => !!h),
);

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Returns true if `target` is one of our known cross-app subdomain
 * URLs that should receive an SSO handoff (i.e. admin or developer).
 * Used to gate `/auth/sso-out` so it can't be turned into an open
 * redirector to arbitrary hosts.
 */
export function isCrossAppTarget(target: string): boolean {
  const host = safeHost(target);
  return host !== null && KNOWN_HOSTS.has(host);
}

/**
 * Returns the `/auth/sso-out?next=...` URL used to start an SSO
 * handoff to another Zervo app. Same-origin, so sidebar links can use
 * a regular `<a href>` and ctrl-click works as expected.
 */
export function ssoOutHref(targetUrl: string): string {
  return `/auth/sso-out?next=${encodeURIComponent(targetUrl)}`;
}

/**
 * Decide where to send a signed-in user after they land on `/auth` (or
 * complete a Google OAuth exchange) with a `next` param attached.
 *
 *   - Same-origin path (`/dashboard`, `/transactions`, ...) → that path.
 *   - Known cross-app URL (admin.zervo.app / developer.zervo.app) →
 *     `/auth/sso-out?next=<url>` so the SSO handoff installs cookies
 *     on the target subdomain. Navigating to the raw URL would land
 *     the user on a subdomain with no session, which would just
 *     redirect them back here and loop.
 *   - Anything else (external host, malformed) → `/dashboard`. Acts as
 *     a closed allowlist against open-redirector abuse.
 */
export function resolveNextTarget(rawNext: string | null | undefined): string {
  if (!rawNext) return "/dashboard";
  if (rawNext.startsWith("/") && !rawNext.startsWith("//")) return rawNext;
  if (isCrossAppTarget(rawNext)) return ssoOutHref(rawNext);
  return "/dashboard";
}
