/**
 * Dedicated OAuth redirect landing page for Plaid.
 *
 * When an OAuth institution like Chase completes authentication, the popup
 * window redirects here with `?oauth_state_id=...`. This page must NOT
 * redirect or navigate away — Plaid Link in the parent window monitors
 * the popup URL to detect the oauth_state_id and complete the handshake.
 *
 * The root page (/) can't be used because PublicRoute redirects
 * authenticated users to /dashboard, which strips the query param and
 * breaks the OAuth flow.
 */
export default function OAuthReturn() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
    </div>
  );
}
