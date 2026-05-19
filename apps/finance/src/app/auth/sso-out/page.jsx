"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import AuthLoadingScreen from "../../../components/auth/AuthLoadingScreen";
import { isCrossAppTarget } from "../../../lib/cross-app";

/**
 * Handoff origin for cross-app SSO. Sidebar links that want to send the
 * signed-in user to admin.zervo.app or developer.zervo.app point at
 * `/auth/sso-out?next=https://<subdomain>/<path>`; this page does the
 * work.
 *
 *   1. Validate that `next` is one of our known cross-app subdomains —
 *      this prevents open-redirector abuse.
 *   2. Read the current Supabase session from localStorage (finance
 *      uses PKCE / localStorage; admin/developer use cookies).
 *   3. If not signed in, bounce through `/auth?next=...` and come back
 *      here once the user finishes Google OAuth.
 *   4. If signed in, redirect to `<target>/auth/sso#access_token=...&
 *      refresh_token=...&next=<path>`. The target subdomain's SSO page
 *      installs the session into its own cookies and lands the user
 *      on the requested path.
 *
 * Tokens go in the URL fragment, not the query string — fragments
 * never hit the server, so they don't end up in our access logs.
 */
function SsoOutHandler() {
  const searchParams = useSearchParams();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const next = searchParams.get("next");

    if (!next || !isCrossAppTarget(next)) {
      // Bad / missing target — punt to dashboard.
      window.location.replace("/dashboard");
      return;
    }

    const targetUrl = new URL(next);

    void (async () => {
      const { supabase } = await import("../../../lib/supabase/client");
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        // Not signed in. Bounce to /auth, and once Google OAuth + the
        // exchange finish they'll come right back here.
        const returnHere = `/auth/sso-out?next=${encodeURIComponent(next)}`;
        window.location.replace(`/auth?next=${encodeURIComponent(returnHere)}`);
        return;
      }

      const ssoUrl = new URL(`${targetUrl.protocol}//${targetUrl.host}/auth/sso`);
      const fragment = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        next: targetUrl.pathname + targetUrl.search,
      });

      window.location.replace(`${ssoUrl.toString()}#${fragment.toString()}`);
    })();
  }, [searchParams]);

  return null;
}

export default function SsoOutPage() {
  return (
    <>
      <AuthLoadingScreen />
      <Suspense>
        <SsoOutHandler />
      </Suspense>
    </>
  );
}
