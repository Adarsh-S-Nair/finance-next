import { supabase } from "../supabase/client";

/**
 * Authenticated fetch wrapper.
 * Reads the current Supabase session and injects the access token
 * as a Bearer Authorization header so the API middleware can verify it.
 *
 * Use this instead of plain `fetch()` for all /api/* calls.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Only inject if we don't already have an Authorization header
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

  return fetch(input, { ...init, headers });
}
