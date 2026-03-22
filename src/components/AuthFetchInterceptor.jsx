"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase/client";

/**
 * Patches window.fetch to automatically inject the Supabase access token
 * as a Bearer Authorization header on all /api/* requests.
 *
 * This ensures API middleware can authenticate requests even when
 * Supabase auth cookies aren't available (e.g., test environments).
 *
 * Mount once in the root layout.
 */
export default function AuthFetchInterceptor() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    window.fetch = async function patchedFetch(input, init) {
      // Determine the URL string
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input instanceof Request
          ? input.url
          : "";

      // Only intercept same-origin /api/ calls
      if (url.startsWith("/api/")) {
        const headers = new Headers(init?.headers);

        if (!headers.has("Authorization")) {
          try {
            const { data } = await supabase.auth.getSession();
            const token = data?.session?.access_token;
            if (token) {
              headers.set("Authorization", `Bearer ${token}`);
            }
          } catch {
            // If we can't get the session, proceed without the header
          }
        }

        return originalFetch.call(this, input, { ...init, headers });
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
