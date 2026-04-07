"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase/client";
import { fetchUserProfile, upsertUserProfile } from "../../lib/user/profile";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";

const UserContext = createContext({
  user: null,
  profile: null,
  loading: true,
  isPro: false,
  subscriptionStatus: null,
  refreshProfile: async () => { },
  setTheme: (_theme) => { },
  setAccentColor: (_hexOrNull) => { },
  logout: () => { },
});

export function useUser() {
  return useContext(UserContext);
}

/**
 * UserProvider — composite provider that orchestrates profile loading,
 * theme/accent persistence, and auth-state-driven redirects.
 *
 * Consumes AuthProvider (user, auth events) and ThemeProvider (DOM helpers).
 * Exports the same useUser() API consumed by all 38+ components.
 */
export default function UserProvider({ children }) {
  const { setToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { user, lastEvent, ensureUser } = useAuth();
  const { applyTheme, applyAccent } = useTheme();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authTransition, setAuthTransition] = useState(false);
  const profileLoadingRef = useRef(false);
  const safetyFiredRef = useRef(false);
  const processedEventRef = useRef(null);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Load profile directly from DB (avoids auth-lock deadlocks). */
  const loadProfileDirect = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, theme, accent_color, avatar_url, first_name, last_name, onboarding_step, subscription_tier, subscription_status")
        .eq("id", userId)
        .maybeSingle();
      setProfile(data || {});
      const isPublic = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");
      if (!isPublic) {
        if (data?.theme) applyTheme(data.theme);
        if (data && Object.prototype.hasOwnProperty.call(data, "accent_color")) applyAccent(data.accent_color);
      }
    } catch (e) {
      console.error("[UserProvider] profile load error", e);
      setProfile({});
    }
  }, [applyTheme, applyAccent]);

  /** Seed profile from Google OAuth metadata on first sign-in (idempotent). */
  const seedGoogleProfile = useCallback(async (u) => {
    const isGoogle = u.app_metadata?.provider === "google" || u.identities?.some((id) => id.provider === "google");
    if (!isGoogle) return;
    try {
      const { data: existing } = await supabase
        .from("user_profiles")
        .select("id, first_name")
        .eq("id", u.id)
        .maybeSingle();
      if (!existing || !existing.first_name) {
        const meta = u.user_metadata || {};
        await supabase.from("user_profiles").upsert(
          {
            id: u.id,
            first_name: meta.given_name || meta.full_name?.split(" ")[0] || null,
            last_name: meta.family_name || (meta.full_name?.split(" ").slice(1).join(" ") || null),
            avatar_url: meta.avatar_url || meta.picture || null,
          },
          { onConflict: "id" },
        );
      }
    } catch (e) {
      console.error("[UserProvider] Google profile seed error", e);
    }
  }, []);

  /** Redirect authenticated users away from public routes (/, /auth/*). */
  const redirectFromPublicRoute = useCallback(
    async (userId) => {
      const isPublic = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");
      if (!isPublic) return false;
      if (!safetyFiredRef.current) {
        setAuthTransition(true);
        setLoading(true);
      }
      try {
        const { data: accounts } = await supabase.from("plaid_items").select("id").eq("user_id", userId).limit(1);
        router.replace(accounts?.length > 0 ? "/dashboard" : "/setup");
      } catch {
        router.replace("/setup");
      }
      return true;
    },
    [router],
  );

  // -----------------------------------------------------------------------
  // Safety timeout — never show loading spinner for more than 4 s
  // -----------------------------------------------------------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      safetyFiredRef.current = true;
      setLoading(false);
      setAuthTransition(false);
    }, 4000);
    return () => clearTimeout(timeout);
  }, []);

  // -----------------------------------------------------------------------
  // React to auth events from AuthProvider
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!lastEvent || lastEvent.ts === processedEventRef.current) return;
    processedEventRef.current = lastEvent.ts;

    const { type, user: eventUser } = lastEvent;

    // Session expired (token refresh failed)
    if (type === "TOKEN_REFRESHED" && !eventUser) {
      setProfile(null);
      applyTheme("light");
      applyAccent(null);
      setAuthTransition(false);
      setLoading(false);
      setToast({ title: "Session expired", description: "Please sign in again", variant: "info" });
      router.replace("/");
      return;
    }

    // Signed out
    if (type === "SIGNED_OUT") {
      setProfile(null);
      applyTheme("light");
      applyAccent(null);
      setAuthTransition(false);
      setLoading(false);
      return;
    }

    // No session on startup
    if (type === "INITIAL_SESSION" && !eventUser) {
      setProfile(null);
      applyTheme("light");
      applyAccent(null);
      setLoading(false);
      return;
    }

    // User signed in or session restored
    if ((type === "SIGNED_IN" || type === "INITIAL_SESSION") && eventUser) {
      profileLoadingRef.current = true;

      (async () => {
        if (type === "SIGNED_IN") await seedGoogleProfile(eventUser);
        await loadProfileDirect(eventUser.id);

        const didRedirect = await redirectFromPublicRoute(eventUser.id);
        if (didRedirect && type === "SIGNED_IN") {
          setToast({ title: "Signed in", variant: "success" });
        }
        if (!didRedirect) {
          setLoading(false);
        }
        profileLoadingRef.current = false;
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent]);

  // -----------------------------------------------------------------------
  // Apply theme/accent on navigation within the app
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!user || !profile) return;
    const isPublic = pathname === "/" || pathname.startsWith("/auth");
    if (!isPublic) {
      if (profile.theme) applyTheme(profile.theme);
      if (Object.prototype.hasOwnProperty.call(profile, "accent_color")) applyAccent(profile.accent_color);
    }
    if (loading) setLoading(false);
    if (authTransition && !isPublic) setAuthTransition(false);
  }, [user, profile, pathname, applyTheme, applyAccent]);

  // -----------------------------------------------------------------------
  // Public API: theme & accent persistence
  // -----------------------------------------------------------------------

  const refreshProfile = useCallback(async () => {
    try {
      const { profile: p } = await fetchUserProfile();
      setProfile(p || {});
      const isPublic = window.location.pathname === "/" || window.location.pathname.startsWith("/auth");
      if (!isPublic) {
        if (p?.theme) applyTheme(p.theme);
        if (p && Object.prototype.hasOwnProperty.call(p, "accent_color")) applyAccent(p.accent_color);
      }
    } catch (e) {
      console.error("[UserProvider] refreshProfile error", e);
      setProfile((prev) => prev || {});
    }
  }, [applyTheme, applyAccent]);

  const setTheme = useCallback(
    async (theme) => {
      applyTheme(theme);
      setProfile((p) => ({ ...(p || {}), theme }));
      try {
        const u = await ensureUser();
        if (!u) throw new Error("No user after ensureUser");
        await upsertUserProfile({ theme });
      } catch (e) {
        console.error("[UserProvider] theme upsert failed", e);
      }
    },
    [applyTheme, ensureUser],
  );

  const setAccentColor = useCallback(
    async (hexOrNull) => {
      applyAccent(hexOrNull || null);
      setProfile((p) => ({ ...(p || {}), accent_color: hexOrNull }));
      try {
        const u = await ensureUser();
        if (!u) throw new Error("No user after ensureUser");
        await upsertUserProfile({ accent_color: hexOrNull });
      } catch (e) {
        console.error("[UserProvider] accent upsert failed", e);
      }
    },
    [applyAccent, ensureUser],
  );

  const logout = useCallback(() => {
    applyTheme("light");
    applyAccent(null);
    setProfile(null);
  }, [applyTheme, applyAccent]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------

  const tier = profile?.subscription_tier || "free";
  const isPro = tier === "pro";
  const subscriptionStatus = profile?.subscription_status || null;

  const value = useMemo(
    () => ({ user, profile, loading, isPro, subscriptionStatus, refreshProfile, setTheme, setAccentColor, logout }),
    [user, profile, loading, isPro, subscriptionStatus, refreshProfile, setTheme, setAccentColor, logout],
  );

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
