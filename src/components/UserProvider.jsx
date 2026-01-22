"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { fetchUserProfile, upsertUserProfile } from "../lib/userProfile";
import { useToast } from "./ToastProvider";

const UserContext = createContext({
  user: null,
  profile: null,
  loading: true,
  setTheme: (_theme) => { },
  setAccentColor: (_hexOrNull) => { },
  logout: () => { },
});

export function useUser() {
  return useContext(UserContext);
}

export default function UserProvider({ children }) {
  const { setToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authTransition, setAuthTransition] = useState(false);
  const fetchedRef = useRef(false);
  const recoveringRef = useRef(false);
  const profileLoadingRef = useRef(false);

  // Helper to clear stale Supabase auth data from localStorage
  const clearStaleAuthData = useCallback(() => {
    if (typeof window === 'undefined') return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }, []);
  const ensureUser = useCallback(async () => {
    if (recoveringRef.current) return user;
    recoveringRef.current = true;
    try {
      let u = null;
      try {
        const { data } = await supabase.auth.getUser();
        u = data?.user ?? null;
      } catch { }
      if (!u) {
        try {
          const { data } = await supabase.auth.refreshSession();
          u = data?.session?.user ?? null;
        } catch { }
      }
      if (!u) {
        try {
          const { data } = await supabase.auth.getSession();
          u = data?.session?.user ?? null;
        } catch { }
      }
      if (u) setUser(u);
      return u;
    } finally {
      recoveringRef.current = false;
    }
  }, [user]);

  // Apply theme without flicker
  const applyTheme = useCallback((theme) => {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const applyAccent = useCallback((hex) => {
    const root = document.documentElement;
    if (!hex) {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-accent-hover");
      root.style.removeProperty("--color-on-accent");
      return;
    }
    root.style.setProperty("--color-accent", hex);
    root.style.setProperty("--color-accent-hover", hex);
    root.style.setProperty("--color-on-accent", "#ffffff");
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { profile } = await fetchUserProfile();
      setProfile(profile);

      // Only apply theme/accent if we are NOT on a public route
      const isPublicRoute = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");

      if (!isPublicRoute) {
        if (profile?.theme) {
          applyTheme(profile.theme);
        }
        if (profile && Object.prototype.hasOwnProperty.call(profile, 'accent_color')) {
          applyAccent(profile.accent_color);
        }
      }
    } catch (error) {
      console.error("[UserProvider] refreshProfile error", error);
    } finally {
      // leave loading state to outer controller
    }
  }, [applyAccent, applyTheme]);

  // Load profile when user exists but profile is null (e.g., after sign in)
  useEffect(() => {
    if (user && !profile && !profileLoadingRef.current) {
      profileLoadingRef.current = true;
      setLoading(true);
      refreshProfile().finally(() => {
        // Only clear loading if we've already navigated away from public routes
        // Otherwise, keep spinning until the route change in the other effect branch handles it
        const isPublic = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");
        if (!isPublic) {
          setLoading(false);
          setAuthTransition(false);
        }
        profileLoadingRef.current = false;
      });
    } else if (user && profile) {
      // If we have user and profile, ensure theme is correct based on route
      // This handles the case where we navigate from Landing (public) -> Dashboard (protected)
      const isPublicRoute = pathname === "/" || pathname.startsWith("/auth");
      if (!isPublicRoute) {
        if (profile.theme) applyTheme(profile.theme);
        if (Object.prototype.hasOwnProperty.call(profile, 'accent_color')) applyAccent(profile.accent_color);

        // Ensure loading overlay is removed once we are on a protected route
        if (loading || authTransition) {
          setLoading(false);
          setAuthTransition(false);
        }
      }
    }
  }, [user, profile, pathname, applyTheme, applyAccent, refreshProfile]);

  useEffect(() => {
    let isMounted = true;
    const onVisibility = async () => {
      if (!document.hidden) {
        try {
          try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch { }
          // Rehydrate auth when tab becomes visible again
          const u = await ensureUser();
        } catch (e) {
          console.log("[UserProvider] visibilitychange error", e);
        }
      } else {
        try { if (supabase?.auth && typeof supabase.auth.stopAutoRefresh === 'function') supabase.auth.stopAutoRefresh(); } catch { }
      }
    };
    const onFocus = async () => {
      try {
        try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch { }
        const u = await ensureUser();
      } catch { }
    };
    const onOnline = async () => {
      try {
        try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch { }
        const u = await ensureUser();
      } catch { }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;

        // Check for refresh token errors
        if (error && error.message && error.message.includes('Refresh Token')) {
          console.log("[UserProvider] Invalid refresh token detected, clearing stale data");
          clearStaleAuthData();
          setProfile(null);
          setUser(null);
          document.documentElement.classList.toggle("dark", false);
          applyAccent(null);
          setLoading(false);
          setToast({ title: "Session expired", description: "Please sign in again", variant: "info" });
          return;
        }

        setUser(data?.user ?? null);
        if (data?.user) {
          if (!fetchedRef.current) {
            fetchedRef.current = true;
            setLoading(true);
            await refreshProfile();
            setLoading(false);
          } else {
            setLoading(false);
          }
        } else {
          setProfile(null);
          // Apply default theme when logged out
          document.documentElement.classList.toggle("dark", false);
          applyAccent(null);
          setLoading(false);
        }
      } catch (err) {
        // Handle AuthApiError for invalid refresh tokens
        if (err && err.message && err.message.includes('Refresh Token')) {
          console.log("[UserProvider] Invalid refresh token error caught, clearing stale data");
          clearStaleAuthData();
          setProfile(null);
          setUser(null);
          document.documentElement.classList.toggle("dark", false);
          applyAccent(null);
          setToast({ title: "Session expired", description: "Please sign in again", variant: "info" });
        }
        if (isMounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      const nextUser = session?.user ?? null;

      // Handle token refresh failures gracefully
      if (event === "TOKEN_REFRESHED" && !session) {
        // Token refresh failed - session is invalid
        console.log("[UserProvider] Session expired, clearing stale data");
        clearStaleAuthData();
        setProfile(null);
        setUser(null);
        document.documentElement.classList.toggle("dark", false);
        applyAccent(null);
        setAuthTransition(false);
        setLoading(false);
        setToast({ title: "Session expired", description: "Please sign in again", variant: "info" });
        router.replace("/");
        return;
      }

      setUser(nextUser);
      fetchedRef.current = false;
      profileLoadingRef.current = false;
      if (event === "SIGNED_IN" && nextUser) {
        const shouldNavigate = typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname.startsWith("/auth"));
        if (shouldNavigate) {
          setAuthTransition(true);
          setLoading(true);
          // Navigate first without loading profile yet
          router.replace("/dashboard");
          // Don't load profile here - let the new useEffect handle it
          setToast({ title: "Signed in", variant: "success" });
          // Don't set loading to false here - let the profile loading useEffect handle it
        } else {
          // Already on an authenticated route; refresh silently without global overlay
          await refreshProfile();
        }
        return;
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
        // Apply default theme when logged out
        document.documentElement.classList.toggle("dark", false);
        applyAccent(null);
        setAuthTransition(false);
        setLoading(false);
        return;
      }
      // Other events: token refresh, user updated, etc. Avoid forcing a loading overlay.
    });
    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      sub.subscription?.unsubscribe?.();
    };
  }, [applyAccent, applyTheme]);

  const setTheme = useCallback(async (theme) => {
    applyTheme(theme);
    setProfile((p) => ({ ...(p || {}), theme }));
    try {
      const u = await ensureUser();
      if (!u) throw new Error("No user after ensureUser");
      await upsertUserProfile({ theme });
    } catch (e) {
      console.error("[UserProvider] theme upsert failed", e);
    }
  }, [applyTheme, ensureUser]);

  const setAccentColor = useCallback(async (hexOrNull) => {
    if (hexOrNull) applyAccent(hexOrNull); else applyAccent(null);
    setProfile((p) => ({ ...(p || {}), accent_color: hexOrNull }));
    try {
      const u = await ensureUser();
      if (!u) throw new Error("No user after ensureUser");
      await upsertUserProfile({ accent_color: hexOrNull });
    } catch (e) {
      console.error("[UserProvider] accent upsert failed", e);
    }
  }, [applyAccent, ensureUser]);

  const logout = useCallback(() => {
    // Reset to light theme and default accent immediately
    applyTheme('light');
    applyAccent(null);
    // Clear profile state
    setProfile(null);
    setUser(null);
  }, [applyTheme, applyAccent]);

  const value = useMemo(() => ({ user, profile, loading, setTheme, setAccentColor, logout }), [user, profile, loading, setTheme, setAccentColor, logout]);

  return (
    <UserContext.Provider value={value}>
      {(loading || authTransition) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-muted)] border-t-[var(--color-accent)]" />
        </div>
      )}
      {children}
    </UserContext.Provider>
  );
}


