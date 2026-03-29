"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { setAccessToken as cacheAccessToken } from "../../lib/supabase/tokenCache";
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
  const safetyFiredRef = useRef(false);

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
      if (!safetyFiredRef.current) setLoading(true);

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
        safetyFiredRef.current = true;
        setLoading(false);
        setAuthTransition(false);
      }
    }, 4000);

    // The init IIFE is intentionally minimal now.
    // We rely on onAuthStateChange (push-based, never blocks) for:
    //   1. Getting the user object
    //   2. Caching the access token
    //   3. Loading the profile
    // This avoids calling getSession()/getUser() which can deadlock
    // due to Supabase's internal auth lock.
    //
    // If onAuthStateChange fires INITIAL_SESSION or SIGNED_IN with a user,
    // the handler below sets the user, loads the profile, and clears loading.
    // If it fires with no user, we clear everything.
    //
    // The safety timeout (above) guarantees loading=false within 4s no matter what.

    const upT0 = Date.now();
    console.log("[UserProvider] Mounting. pathname:", window.location.pathname, "loading:", true);

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[UserProvider] onAuthStateChange:", event, "user:", !!session?.user, "elapsed:", Date.now() - upT0, "ms");
      // Cache the access token immediately — this is push-based and never blocks
      cacheAccessToken(session?.access_token ?? null);
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
        console.log("[UserProvider] redirectFromPublicRoute: pathname:", window.location.pathname, "isPublic:", isOnPublicRoute);
        if (!isOnPublicRoute) return false;

        if (!safetyFiredRef.current) {
          setAuthTransition(true);
          setLoading(true);
        }
        try {
          // Check if user has linked accounts — use direct Supabase query to avoid auth lock
          console.log("[UserProvider] redirectFromPublicRoute: checking accounts...");
          const { data: accounts } = await supabase
            .from("plaid_items")
            .select("id")
            .eq("user_id", nextUser.id)
            .limit(1);
          const hasAccounts = Array.isArray(accounts) && accounts.length > 0;
          const dest = hasAccounts ? "/dashboard" : "/setup";
          console.log("[UserProvider] redirectFromPublicRoute: redirecting to", dest, "hasAccounts:", hasAccounts);
          router.replace(dest);
        } catch (err) {
          console.error("[UserProvider] redirectFromPublicRoute error:", err);
          router.replace("/setup");
        }
        return true;
      };

      if (event === "SIGNED_IN" && nextUser) {
        console.log("[UserProvider] SIGNED_IN handler start. pathname:", window.location.pathname);
        // Only reset refs on actual sign-in, not on INITIAL_SESSION/TOKEN_REFRESHED
        fetchedRef.current = true;
        profileLoadingRef.current = true;

        // For Google OAuth sign-ins, seed profile from user_metadata if no profile exists yet.
        // IMPORTANT: Do NOT call supabase.auth.getUser()/getSession() inside onAuthStateChange —
        // Supabase holds an internal auth lock during this callback, so those calls deadlock.
        // Use nextUser.id directly and query Supabase DB without going through auth helpers.
        const isGoogleProvider = nextUser.app_metadata?.provider === "google" ||
          nextUser.identities?.some((id) => id.provider === "google");
        console.log("[UserProvider] SIGNED_IN: isGoogle:", isGoogleProvider);
        if (isGoogleProvider) {
          try {
            console.log("[UserProvider] SIGNED_IN: seeding Google profile...");
            // Query profile directly by user ID — avoids auth lock deadlock
            const { data: existingProfile } = await supabase
              .from("user_profiles")
              .select("id, first_name")
              .eq("id", nextUser.id)
              .maybeSingle();
            console.log("[UserProvider] SIGNED_IN: existing profile:", !!existingProfile, "first_name:", existingProfile?.first_name);
            if (!existingProfile || !existingProfile.first_name) {
              const meta = nextUser.user_metadata || {};
              const firstName = meta.given_name || meta.full_name?.split(" ")[0] || null;
              const lastName = meta.family_name || (meta.full_name?.split(" ").slice(1).join(" ") || null);
              const avatarUrl = meta.avatar_url || meta.picture || null;
              console.log("[UserProvider] SIGNED_IN: upserting Google profile. name:", firstName, lastName);
              await supabase
                .from("user_profiles")
                .upsert({ id: nextUser.id, first_name: firstName, last_name: lastName, avatar_url: avatarUrl }, { onConflict: "id" });
              console.log("[UserProvider] SIGNED_IN: Google profile upserted");
            }
          } catch (e) {
            console.error("[UserProvider] Google profile seed error", e);
          }
        }

        // Load profile directly without going through auth-dependent helpers
        console.log("[UserProvider] SIGNED_IN: loading profile directly...");
        try {
          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("id, theme, accent_color, avatar_url, first_name, last_name, onboarding_step, subscription_tier")
            .eq("id", nextUser.id)
            .maybeSingle();
          setProfile(profileData || {});
          const isPublicRoute = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");
          if (!isPublicRoute && profileData?.theme) applyTheme(profileData.theme);
          if (!isPublicRoute && profileData && Object.prototype.hasOwnProperty.call(profileData, 'accent_color')) applyAccent(profileData.accent_color);
        } catch (e) {
          console.error("[UserProvider] SIGNED_IN: profile load error", e);
          setProfile({});
        }

        console.log("[UserProvider] SIGNED_IN: calling redirectFromPublicRoute...");
        if (await redirectFromPublicRoute()) {
          console.log("[UserProvider] SIGNED_IN: redirect initiated");
          profileLoadingRef.current = false;
          setToast({ title: "Signed in", variant: "success" });
        } else {
          console.log("[UserProvider] SIGNED_IN: no redirect needed");
          profileLoadingRef.current = false;
          setLoading(false);
          console.log("[UserProvider] SIGNED_IN: done, loading=false");
        }
        return;
      }

      // Handle existing session restoration.
      // Supabase fires INITIAL_SESSION (not SIGNED_IN) when restoring a session from storage.
      if (event === "INITIAL_SESSION" && nextUser) {
        console.log("[UserProvider] INITIAL_SESSION with user. pathname:", window.location.pathname, "fetchedRef:", fetchedRef.current);
        // Load profile directly — avoid auth lock deadlock
        if (!fetchedRef.current) {
          fetchedRef.current = true;
          profileLoadingRef.current = true;
          console.log("[UserProvider] INITIAL_SESSION: loading profile directly...");
          try {
            const { data: profileData } = await supabase
              .from("user_profiles")
              .select("id, theme, accent_color, avatar_url, first_name, last_name, onboarding_step, subscription_tier")
              .eq("id", nextUser.id)
              .maybeSingle();
            setProfile(profileData || {});
            const isPublicRoute = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");
            if (!isPublicRoute && profileData?.theme) applyTheme(profileData.theme);
            if (!isPublicRoute && profileData && Object.prototype.hasOwnProperty.call(profileData, 'accent_color')) applyAccent(profileData.accent_color);
          } catch (e) {
            console.error("[UserProvider] INITIAL_SESSION: profile load error", e);
            setProfile({});
          }
          profileLoadingRef.current = false;
          console.log("[UserProvider] INITIAL_SESSION: profile loaded");
        }
        const didRedirect = await redirectFromPublicRoute();
        console.log("[UserProvider] INITIAL_SESSION: didRedirect:", didRedirect);
        if (!didRedirect) {
          setLoading(false);
        }
        return;
      }
      if (event === "INITIAL_SESSION" && !nextUser) {
        // No session found — user is logged out
        console.log("[UserProvider] INITIAL_SESSION: no user, setting loading=false");
        setProfile(null);
        document.documentElement.classList.toggle("dark", false);
        applyAccent(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") {
        clearStaleAuthData();
        setProfile(null);
        setUser(null);
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
      {authTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-muted)] border-t-[var(--color-accent)]" />
        </div>
      )}
      {children}
    </UserContext.Provider>
  );
}


