"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Avoid auto-refreshing on the server side to prevent memory leaks from timers
const isServer = typeof window === 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isServer,
    autoRefreshToken: !isServer,
    detectSessionInUrl: !isServer,
    flowType: "pkce",
  },
});

// Helper to clear stale Supabase auth data from localStorage
const clearStaleAuthData = () => {
  if (typeof window === 'undefined') return;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

// Set up a global listener to catch auth errors early (before component mount)
// This prevents the "Invalid Refresh Token" error from appearing in the console
if (!isServer) {
  supabase.auth.onAuthStateChange((event, session) => {
    // If token refresh happened but session is null, the refresh failed
    if (event === 'TOKEN_REFRESHED' && !session) {
      console.log('[Supabase] Invalid refresh token detected, clearing stale session data');
      clearStaleAuthData();
    }
  });

  // Stop auto-refresh when tab is hidden (computer sleeping/AFK) to prevent network errors
  // Resume when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tab is hidden - stop trying to refresh tokens (prevents ERR_ADDRESS_UNREACHABLE spam)
      supabase.auth.stopAutoRefresh();
    } else {
      // Tab is visible again - resume auto-refresh
      supabase.auth.startAutoRefresh();
    }
  });

  // Also handle online/offline events
  window.addEventListener('offline', () => {
    // No network - stop trying to refresh
    supabase.auth.stopAutoRefresh();
  });

  window.addEventListener('online', () => {
    // Network restored - resume auto-refresh
    supabase.auth.startAutoRefresh();
  });
}
