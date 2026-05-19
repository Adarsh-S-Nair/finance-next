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
