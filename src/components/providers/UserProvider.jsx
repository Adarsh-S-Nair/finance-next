"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { fetchUserProfile, upsertUserProfile } from "../../lib/user/profile";
import { useToast } from "./ToastProvider";
import { authFetch } from "../../lib/api/fetch";
import { canAccess } from "../../lib/tierConfigClient";

const UserContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isPro: false,
  refreshProfile: async () => { },
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
      // Prefer getSession (localStorage, no network) over getUser (network call that can hang)
      try {
        const { data } = await supabase.auth.getSession();
        u = data?.session?.user ?? null;
      } catch { }
      if (!u) {
        try {
          const result = await Promise.race([
            supabase.auth.getUser(),
            new Promise((resolve) => setTimeout(() => resolve({ data: { user: null } }), 3000)),
          ]);
          u = result?.data?.user ?? null;
        } catch { }
      }
      if (!u) {
        try {
          const result = await Promise.race([
            supabase.auth.refreshSession(),
            new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
          ]);
          u = result?.data?.session?.user ?? null;
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
      // Always set a truthy value so the "user && !profile" effect doesn't loop
      // when the user has no profile row yet (new accounts)
      setProfile(profile || {});

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
      // Even on error, set profile to empty object to prevent infinite loop
      setProfile((prev) => prev || {});
    } finally {
      // leave loading state to outer controller
    }
  }, [applyAccent, applyTheme]);

  // Load profile when user exists but profile is null (e.g., after sign in)
  useEffect(() => {
    if (user && !profile && !profileLoadingRef.current) {
      profileLoadingRef.current = true;
      setLoading(true);

      // Safety timeout: never spin for more than 5 seconds
      const timeout = setTimeout(() => {
        setLoading(false);
        setAuthTransition(false);
        profileLoadingRef.current = false;
      }, 5000);

      refreshProfile().finally(() => {
        clearTimeout(timeout);
        // Always clear loading once profile is resolved — the auth-transition
        // redirect flow manages its own overlay via authTransition state
        setLoading(false);
        profileLoadingRef.current = false;
      });
    } else if (user && profile) {
      // Apply theme/accent on protected routes
      const isPublicRoute = pathname === "/" || pathname.startsWith("/auth");
      if (!isPublicRoute) {
        if (profile.theme) applyTheme(profile.theme);
        if (Object.prototype.hasOwnProperty.call(profile, 'accent_color')) applyAccent(profile.accent_color);
      }

      // Always clear loading when we have both user and profile
      if (loading) setLoading(false);
      if (authTransition && !isPublicRoute) setAuthTransition(false);
    }
  }, [user, profile, pathname, applyTheme, applyAccent, refreshProfile]);

  useEffect(() => {
    let isMounted = true;
    const onVisibility = async () => {
      if (!document.hidden) {
        try {
          try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch { }
          // Rehydrate auth silently — don't trigger loading overlay
          await ensureUser();
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
        await ensureUser();
      } catch { }
    };
    const onOnline = async () => {
      try {
        try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch { }
        await ensureUser();
      } catch { }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // Safety timeout: never show loading spinner for more than 4 seconds on init
    const initTimeout = setTimeout(() => {
      if (isMounted) {
        console.log("[UserProvider] Safety timeout fired — forcing loading=false");
        setLoading(false);
        setAuthTransition(false);
      }
    }, 4000);

    (async () => {
      console.log("[UserProvider] Init IIFE starting");
      try {
        // Step 1: Read session from localStorage (synchronous, no network)
        let sessionUser = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          sessionUser = sessionData?.session?.user ?? null;
          console.log("[UserProvider] getSession result:", { user: !!sessionUser });
        } catch {
          // No local session
        }

        if (!sessionUser) {
          // No local session at all — user is logged out
          console.log("[UserProvider] No session found, user is logged out");
          setProfile(null);
          setUser(null);
          document.documentElement.classList.toggle("dark", false);
          applyAccent(null);
          setLoading(false);
          return;
        }

        // Step 2: We have a local session — use it immediately so components can fetch data.
        // Then validate with getUser() in the background (with a timeout).
        setUser(sessionUser);
        if (!fetchedRef.current) {
          fetchedRef.current = true;
          profileLoadingRef.current = true;
          await refreshProfile();
          profileLoadingRef.current = false;
          console.log("[UserProvider] Profile loaded, setting loading=false");
          if (isMounted) setLoading(false);
        } else {
          console.log("[UserProvider] Already fetched, setting loading=false");
          if (isMounted) setLoading(false);
        }

        // Step 3: Background validation — verify the token is still valid server-side.
        // If it fails, sign the user out. Use a timeout so it never blocks the UI.
        try {
          const getUserResult = await Promise.race([
            supabase.auth.getUser(),
            new Promise((resolve) => setTimeout(() => resolve({ data: { user: null }, error: new Error("getUser timeout") }), 5000)),
          ]);
          console.log("[UserProvider] getUser validation:", { user: !!getUserResult?.data?.user, error: getUserResult?.error?.message });
          if (!isMounted) return;

          const validationError = getUserResult?.error;
          if (validationError && validationError.message && (validationError.message.includes('Refresh Token') || validationError.message.includes('refresh_token'))) {
            clearStaleAuthData();
            setProfile(null);
            setUser(null);
            document.documentElement.classList.toggle("dark", false);
            applyAccent(null);
            setLoading(false);
            if (fetchedRef.current) {
              setToast({ title: "Session expired", description: "Please sign in again", variant: "info" });
            }
          }
          // If getUser timed out or returned no user but we have a session, keep going —
          // the session token is still valid for API calls via middleware
        } catch (err) {
          console.log("[UserProvider] getUser background validation error:", err?.message);
          // Non-fatal — we already have a session, keep going
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
      console.log("[UserProvider] onAuthStateChange:", event, "user:", !!session?.user);
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

      // Helper: redirect authenticated users away from public routes (/, /auth)
      const redirectFromPublicRoute = async () => {
        const isOnPublicRoute = typeof window !== "undefined" &&
          (window.location.pathname === "/" || window.location.pathname.startsWith("/auth"));
        if (!isOnPublicRoute) return false;

        setAuthTransition(true);
        setLoading(true);
        try {
          // Load profile in parallel with account check so it's ready after redirect
          const [, res] = await Promise.all([
            refreshProfile(),
            authFetch("/api/plaid/accounts").catch(() => null),
          ]);
          const body = res?.ok ? await res.json() : { accounts: [] };
          const hasAccounts = Array.isArray(body.accounts) && body.accounts.length > 0;
          router.replace(hasAccounts ? "/dashboard" : "/setup");
        } catch {
          router.replace("/setup");
        }
        // Note: loading/authTransition will be cleared by the [user,profile] effect
        // once the route changes to a protected route and profile is set
        return true;
      };

      if (event === "SIGNED_IN" && nextUser) {
        // Only reset refs on actual sign-in, not on INITIAL_SESSION/TOKEN_REFRESHED
        fetchedRef.current = true; // mark as fetched so init IIFE doesn't double-fetch
        profileLoadingRef.current = true;

        // For Google OAuth sign-ins, seed profile from user_metadata if no profile exists yet
        const isGoogleProvider = nextUser.app_metadata?.provider === "google" ||
          nextUser.identities?.some((id) => id.provider === "google");
        if (isGoogleProvider) {
          try {
            const { fetchUserProfile: fetchP, upsertUserProfile: upsertP } = await import("../../lib/user/profile");
            const { profile: existingProfile } = await fetchP();
            if (!existingProfile || !existingProfile.first_name) {
              const meta = nextUser.user_metadata || {};
              const firstName = meta.given_name || meta.full_name?.split(" ")[0] || null;
              const lastName = meta.family_name || (meta.full_name?.split(" ").slice(1).join(" ") || null);
              const avatarUrl = meta.avatar_url || meta.picture || null;
              await upsertP({
                first_name: firstName || null,
                last_name: lastName || null,
                avatar_url: avatarUrl || null,
              });
            }
          } catch (e) {
            console.error("[UserProvider] Google profile seed error", e);
          }
        }

        if (await redirectFromPublicRoute()) {
          // Profile will be loaded by the [user,profile] effect after redirect
          profileLoadingRef.current = false;
          setToast({ title: "Signed in", variant: "success" });
        } else {
          // Already on an authenticated route; refresh silently without global overlay
          await refreshProfile();
          profileLoadingRef.current = false;
          setLoading(false);
        }
        return;
      }

      // Handle existing session on public routes (e.g. refreshing /auth while logged in).
      // Supabase fires INITIAL_SESSION (not SIGNED_IN) when restoring a session from storage.
      if (event === "INITIAL_SESSION" && nextUser) {
        await redirectFromPublicRoute();
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
      clearTimeout(initTimeout);
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

  // isPro derives from the centralized tier config — pro tier has access to budgets/investments etc.
  // Using canAccess as the single source of truth for what "pro" means
  const isPro = canAccess(profile?.subscription_tier || 'free', 'budgets');

  const value = useMemo(() => ({ user, profile, loading, isPro, refreshProfile, setTheme, setAccentColor, logout }), [user, profile, loading, isPro, refreshProfile, setTheme, setAccentColor, logout]);

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


