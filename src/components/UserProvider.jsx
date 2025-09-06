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
  setTheme: (_theme) => {},
  setAccentColor: (_hexOrNull) => {},
  logout: () => {},
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
  const ensureUser = useCallback(async () => {
    if (recoveringRef.current) return user;
    recoveringRef.current = true;
    try {
      let u = null;
      try {
        const { data } = await supabase.auth.getUser();
        u = data?.user ?? null;
      } catch {}
      if (!u) {
        try {
          const { data } = await supabase.auth.refreshSession();
          u = data?.session?.user ?? null;
        } catch {}
      }
      if (!u) {
        try {
          const { data } = await supabase.auth.getSession();
          u = data?.session?.user ?? null;
        } catch {}
      }
      if (u) setUser(u);
      return u;
    } finally {
      recoveringRef.current = false;
    }
  }, [user]);

  // Apply theme without flicker
  const applyTheme = useCallback((theme) => {
    const isDark = theme === "dark" || (theme !== "light" && (localStorage.getItem("theme.dark") === "1"));
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
      if (profile?.theme) {
        applyTheme(profile.theme);
      }
      if (profile && Object.prototype.hasOwnProperty.call(profile, 'accent_color')) {
        applyAccent(profile.accent_color);
      }
    } finally {
      // leave loading state to outer controller
    }
  }, [applyAccent, applyTheme]);

  useEffect(() => {
    let isMounted = true;
    const onVisibility = async () => {
      if (!document.hidden) {
        try {
          try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch {}
          // Rehydrate auth when tab becomes visible again
          const u = await ensureUser();
          console.log("[UserProvider] visibilitychange rehydrate", { hasUser: !!u });
        } catch (e) {
          console.log("[UserProvider] visibilitychange error", e);
        }
      } else {
        try { if (supabase?.auth && typeof supabase.auth.stopAutoRefresh === 'function') supabase.auth.stopAutoRefresh(); } catch {}
      }
    };
    const onFocus = async () => {
      try {
        try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch {}
        const u = await ensureUser();
        console.log("[UserProvider] window focus rehydrate", { hasUser: !!u });
      } catch {}
    };
    const onOnline = async () => {
      try {
        try { if (supabase?.auth && typeof supabase.auth.startAutoRefresh === 'function') supabase.auth.startAutoRefresh(); } catch {}
        const u = await ensureUser();
        console.log("[UserProvider] online rehydrate", { hasUser: !!u });
      } catch {}
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        console.log("[UserProvider] initial getUser", { hasUser: !!data?.user });
        if (!isMounted) return;
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
          // Apply local theme when logged out
          const saved = localStorage.getItem("theme.dark") === "1";
          document.documentElement.classList.toggle("dark", saved);
          applyAccent(null);
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[UserProvider] onAuthStateChange", { event, hasSession: !!session });
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      fetchedRef.current = false;
      if (event === "SIGNED_IN" && nextUser) {
        const shouldNavigate = typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname.startsWith("/auth"));
        if (shouldNavigate) {
          setAuthTransition(true);
          setLoading(true);
          router.replace("/dashboard");
          await refreshProfile();
          setToast({ title: "Signed in", variant: "success" });
          setAuthTransition(false);
          setLoading(false);
        } else {
          // Already on an authenticated route; refresh silently without global overlay
          await refreshProfile();
        }
        return;
      }
      if (event === "SIGNED_OUT") {
        setProfile(null);
        const saved = localStorage.getItem("theme.dark") === "1";
        document.documentElement.classList.toggle("dark", saved);
        applyAccent(null);
        try { localStorage.setItem("theme.accent", "default"); } catch {}
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
    console.log("[UserProvider] setTheme", theme);
    applyTheme(theme);
    setProfile((p) => ({ ...(p || {}), theme }));
    try {
      console.log("[UserProvider] ensuring user before theme upsert");
      const u = await ensureUser();
      if (!u) throw new Error("No user after ensureUser");
      const res = await upsertUserProfile({ theme });
      console.log("[UserProvider] theme upsert result", res);
    } catch (e) {
      console.error("[UserProvider] theme upsert failed", e);
    } finally {
      console.log("[UserProvider] theme upsert finished");
    }
  }, [applyTheme, ensureUser]);

  const setAccentColor = useCallback(async (hexOrNull) => {
    console.log("[UserProvider] setAccentColor", hexOrNull);
    if (hexOrNull) applyAccent(hexOrNull); else applyAccent(null);
    setProfile((p) => ({ ...(p || {}), accent_color: hexOrNull }));
    try {
      console.log("[UserProvider] ensuring user before accent upsert");
      const u = await ensureUser();
      if (!u) throw new Error("No user after ensureUser");
      const res = await upsertUserProfile({ accent_color: hexOrNull });
      console.log("[UserProvider] accent upsert result", res);
    } catch (e) {
      console.error("[UserProvider] accent upsert failed", e);
    } finally {
      console.log("[UserProvider] accent upsert finished");
    }
  }, [applyAccent, ensureUser]);

  const logout = useCallback(() => {
    console.log("[UserProvider] logout - resetting theme and accent");
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


