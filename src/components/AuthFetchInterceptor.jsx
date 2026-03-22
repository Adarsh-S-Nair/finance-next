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
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input instanceof Request) {
        url = input.url;
      }

      // Only intercept same-origin /api/ calls
      const isApiCall = url.startsWith("/api/") ||
        (typeof window !== "undefined" && url.startsWith(window.location.origin + "/api/"));

      if (isApiCall) {
        // Check if we already have an Authorization header
        let hasAuth = false;
        if (init?.headers) {
          const h = new Headers(init.headers);
          hasAuth = h.has("Authorization");
        }
        if (!hasAuth && input instanceof Request) {
          hasAuth = input.headers.has("Authorization");
        }

        if (!hasAuth) {
          try {
            const { data } = await supabase.auth.getSession();
            const token = data?.session?.access_token;
            if (token) {
              // Build a clean headers object
              const mergedHeaders = new Headers(
                input instanceof Request ? input.headers : init?.headers
              );
              mergedHeaders.set("Authorization", `Bearer ${token}`);

              if (input instanceof Request) {
                // Clone the request with the new headers
                const newRequest = new Request(input, { headers: mergedHeaders });
                return originalFetch.call(this, newRequest, init);
              }

              return originalFetch.call(this, input, {
                ...init,
                headers: mergedHeaders,
              });
            }
          } catch {
            // If we can't get the session, proceed without the header
          }
        }
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
