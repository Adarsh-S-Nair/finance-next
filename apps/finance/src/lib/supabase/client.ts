"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";
import { getAccessToken as getCachedToken } from "./tokenCache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Avoid auto-refreshing on the server side to prevent memory leaks from timers
const isServer = typeof window === 'undefined';

const createServerSafeStub = () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    refreshSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => ({
      data: null,
      error: new Error("Supabase client unavailable during server build"),
    }),
    signInWithOAuth: async () => ({
      data: null,
      error: new Error("Supabase client unavailable during server build"),
    }),
    signUp: async () => ({
      data: null,
      error: new Error("Supabase client unavailable during server build"),
    }),
    updateUser: async () => ({
      data: null,
      error: new Error("Supabase client unavailable during server build"),
    }),
    resetPasswordForEmail: async () => ({
      data: null,
      error: new Error("Supabase client unavailable during server build"),
    }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } },
    }),
    startAutoRefresh: () => {},
    stopAutoRefresh: () => {},
  },
});

// Type the export as the real client even when we're falling back to the
// stub during server build. The stub only implements `auth.*`, but module
// consumers always check for the right surface before using it; keeping the
// type narrow here would force every caller to add a build-only narrowing.
export const supabase = (
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: !isServer,
          autoRefreshToken: !isServer,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : createServerSafeStub()
) as SupabaseClient<Database>;

// Helper to clear stale Supabase auth data from localStorage
const clearStaleAuthData = (): void => {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

// Set up a global listener to catch auth errors early (before component mount)
// This prevents the "Invalid Refresh Token" error from appearing in the console
if (!isServer) {
  supabase.auth.onAuthStateChange((event, session) => {
    // If token refresh happened but session is null, the refresh failed
    if (event === 'TOKEN_REFRESHED' && !session) {
      clearStaleAuthData();
      // Force a clean sign-out so no component is left waiting for auth
      supabase.auth.signOut().catch((err: { message?: string }) =>
        console.warn('Sign-out after failed token refresh:', err.message)
      );
    }
  });

  // Stop auto-refresh when tab is hidden (computer sleeping/AFK) to prevent network errors
  // Resume when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      supabase.auth.stopAutoRefresh();
    } else {
      supabase.auth.startAutoRefresh();
    }
  });

  window.addEventListener('offline', () => {
    supabase.auth.stopAutoRefresh();
  });

  window.addEventListener('online', () => {
    supabase.auth.startAutoRefresh();
  });

  // Patch window.fetch to inject auth token on /api/* calls
  // This runs at module load time so it's ready before any component effects
  interface PatchedWindow extends Window {
    __authFetchPatched?: boolean;
  }
  const w = window as PatchedWindow;
  if (!w.__authFetchPatched) {
    w.__authFetchPatched = true;
    const originalFetch = window.fetch;

    window.fetch = async function patchedFetch(
      this: typeof globalThis,
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      let url = "";
      if (typeof input === "string") url = input;
      else if (input instanceof URL) url = input.toString();
      else if (input instanceof Request) url = input.url;

      const isApiCall =
        url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/");

      if (isApiCall) {
        let hasAuth = false;
        if (init?.headers) {
          const h = new Headers(init.headers);
          hasAuth = h.has("Authorization");
        }
        if (!hasAuth && input instanceof Request) hasAuth = input.headers.has("Authorization");

        if (!hasAuth) {
          try {
            // Use cached token first (instant), fall back to getSession with timeout
            let token = getCachedToken();
            if (!token) {
              const sessionResult = (await Promise.race([
                supabase.auth.getSession(),
                new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2000)),
              ])) as { data?: { session?: { access_token?: string } | null } | null };
              token = sessionResult?.data?.session?.access_token ?? null;
            }
            if (token) {
              const mergedHeaders = new Headers(
                input instanceof Request ? input.headers : init?.headers
              );
              mergedHeaders.set("Authorization", `Bearer ${token}`);
              if (input instanceof Request) {
                return originalFetch.call(
                  this,
                  new Request(input, { headers: mergedHeaders }),
                  init
                );
              }
              return originalFetch.call(this, input, { ...init, headers: mergedHeaders });
            }
          } catch {
            /* proceed without auth */
          }
        }
      }

      return originalFetch.call(this, input, init);
    };
  }
}
