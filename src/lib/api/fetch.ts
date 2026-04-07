import { supabase } from "../supabase/client";
import { getAccessToken as getCachedToken } from "../supabase/tokenCache";

async function getAccessToken(): Promise<string | null> {
  // 1. Try the push-based cache first (instant, never blocks)
  const cached = getCachedToken();
  if (cached) return cached;

  // 2. Fallback: try getSession with a tight timeout
  // (getSession can deadlock if Supabase's internal lock is held)
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 2000)),
    ]);
    const token = result?.data?.session?.access_token;
    if (token) return token;
  } catch {
    // fall through
  }

  // 3. Last resort: try refresh with timeout
  try {
    const result = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 2000)),
    ]);
    return result?.data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

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
  const hadAuthHeader = headers.has("Authorization");

  // Inject auth if missing
  if (!hadAuthHeader) {
    const token = await getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response = await fetch(input, { ...init, headers });

  // If auth wasn't ready yet and middleware returned 401, force a real token refresh + retry.
  if (!hadAuthHeader && response.status === 401) {
    try {
      const refreshResult = await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
      ]);
      const retryToken = refreshResult?.data?.session?.access_token ?? null;
      if (retryToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${retryToken}`);
        response = await fetch(input, { ...init, headers: retryHeaders });
      }
    } catch {
      // Refresh failed, return original 401 response
    }
  }

  // Retry on 429 (rate limited) — respect Retry-After header, up to 2 attempts
  if (response.status === 429) {
    const signal = init?.signal;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) break;
      const retryAfter = response.headers.get("Retry-After");
      const delayMs = retryAfter
        ? Math.min(parseInt(retryAfter, 10) * 1000, 5000)
        : 1000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, delayMs));
      if (signal?.aborted) break;
      response = await fetch(input, { ...init, headers });
      if (response.status !== 429) break;
    }
  }

  return response;
}
