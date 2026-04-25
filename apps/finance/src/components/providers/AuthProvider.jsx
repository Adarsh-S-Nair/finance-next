"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { setAccessToken as cacheAccessToken } from "../../lib/supabase/tokenCache";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * AuthProvider — owns Supabase auth state, session recovery, and token caching.
 *
 * Downstream providers (UserProvider) watch `lastEvent` to react to auth
 * changes (profile loading, redirects, theme application).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [lastEvent, setLastEvent] = useState(null); // { type, user, ts }
  const recoveringRef = useRef(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearStaleAuthData = useCallback(() => {
    if (typeof window === "undefined") return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-")) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  }, []);

  const ensureUser = useCallback(async () => {
    if (recoveringRef.current) return userRef.current;
    recoveringRef.current = true;
    try {
      let u = null;
      try {
        const { data } = await supabase.auth.getSession();
        u = data?.session?.user ?? null;
      } catch { /* ignore */ }
      if (!u) {
        try {
          const result = await Promise.race([
            supabase.auth.getUser(),
            new Promise((r) => setTimeout(() => r({ data: { user: null } }), 3000)),
          ]);
          u = result?.data?.user ?? null;
        } catch { /* ignore */ }
      }
      if (!u) {
        try {
          const result = await Promise.race([
            supabase.auth.refreshSession(),
            new Promise((r) => setTimeout(() => r({ data: null }), 3000)),
          ]);
          u = result?.data?.session?.user ?? null;
        } catch { /* ignore */ }
      }
      if (u) setUser(u);
      return u;
    } finally {
      recoveringRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Session recovery: rehydrate auth on visibility/focus/online
    const onVisibility = async () => {
      if (!document.hidden) {
        try { if (typeof supabase.auth.startAutoRefresh === "function") supabase.auth.startAutoRefresh(); } catch { /* ignore */ }
        await ensureUser();
      } else {
        try { if (typeof supabase.auth.stopAutoRefresh === "function") supabase.auth.stopAutoRefresh(); } catch { /* ignore */ }
      }
    };
    const onFocus = async () => {
      try { if (typeof supabase.auth.startAutoRefresh === "function") supabase.auth.startAutoRefresh(); } catch { /* ignore */ }
      try { await ensureUser(); } catch { /* ignore */ }
    };
    const onOnline = async () => {
      try { if (typeof supabase.auth.startAutoRefresh === "function") supabase.auth.startAutoRefresh(); } catch { /* ignore */ }
      try { await ensureUser(); } catch { /* ignore */ }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // Subscribe to Supabase auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      cacheAccessToken(session?.access_token ?? null);
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLastEvent({ type: event, user: nextUser, ts: Date.now() });

      // Handle sign-out: clear stale localStorage entries
      if (event === "SIGNED_OUT") {
        clearStaleAuthData();
      }
      // Handle failed token refresh: treat as sign-out
      if (event === "TOKEN_REFRESHED" && !session) {
        clearStaleAuthData();
        setUser(null);
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      sub.subscription?.unsubscribe?.();
    };
  }, [ensureUser, clearStaleAuthData]);

  const value = useMemo(
    () => ({ user, lastEvent, ensureUser, clearStaleAuthData }),
    [user, lastEvent, ensureUser, clearStaleAuthData],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
