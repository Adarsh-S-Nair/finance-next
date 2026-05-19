"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = "zervo-theme";

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

function readDomTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage can throw in private mode; ignore
  }
}

/**
 * Theme persistence backed by `user_profiles.theme` — the same column the
 * finance app writes to, so toggling dark mode on one surface flips every
 * Zervo surface (finance, admin, developer) the next time the user opens
 * it. localStorage is kept as a fast-restore cache so ThemeScript can
 * paint the right theme before hydration.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Initial: read whatever ThemeScript already applied to the DOM (from
  // localStorage). That's the cache value until the Supabase fetch lands.
  useEffect(() => {
    setThemeState(readDomTheme());
  }, []);

  // Sync from user_profiles once signed in. user_profiles.theme is the
  // canonical value across all Zervo surfaces; if it diverges from the
  // cache (e.g. user changed theme in finance since their last admin
  // visit), reconcile to it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("theme")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (cancelled) return;
      const remote: Theme | null =
        data?.theme === "dark" ? "dark" : data?.theme === "light" ? "light" : null;
      if (remote && remote !== readDomTheme()) {
        applyTheme(remote);
        setThemeState(remote);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback(async (next: Theme) => {
    applyTheme(next);
    setThemeState(next);
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase
        .from("user_profiles")
        .upsert({ id: auth.user.id, theme: next });
    } catch (e) {
      console.error("[ThemeProvider] failed to persist theme to user_profiles", e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
