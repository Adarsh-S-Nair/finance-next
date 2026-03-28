import { supabase } from "../supabase/client";

async function getAccessToken(): Promise<string | null> {
  // Use a timeout to prevent hanging if Supabase's internal lock is held
  // (e.g. a pending getUser() call blocking getSession())
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
    ]);
    const token = result?.data?.session?.access_token;
    if (token) return token;
  } catch {
    // fall through to refresh attempt
  }

  try {
    const result = await Promise.race([
      supabase.auth.refreshSession(),
      new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
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

  // Inject auth if missing. On refresh/HMR, Supabase session restoration can lag a bit,
  // so try getSession first, then a refreshSession fallback.
  if (!hadAuthHeader) {
    const token = await getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response = await fetch(input, { ...init, headers });

  // If auth wasn't ready yet and middleware returned 401, try one token refresh + retry.
  if (!hadAuthHeader && response.status === 401) {
    const retryToken = await getAccessToken();
    if (retryToken) {
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("Authorization", `Bearer ${retryToken}`);
      response = await fetch(input, { ...init, headers: retryHeaders });
    }
  }

  return response;
}
