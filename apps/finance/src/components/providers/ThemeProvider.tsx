"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import {
  applyThemeToDocument,
  resolveThemeId,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
} from "../../config/themes";

type ThemeContextValue = {
  applyTheme: (themeId: string) => void;
  applyAccent: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const applyTheme = useCallback((themeId: string) => {
    applyThemeToDocument(themeId);
    // Cache the authoritative preference so the next load paints it
    // synchronously (see the boot script in the root layout). Only the user's
    // real theme — or the signed-out light reset — flows through here; the
    // force-light FTUX/auth screens call applyThemeToDocument directly and so
    // never poison this cache.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolveThemeId(themeId));
    } catch {}
  }, []);

  const applyAccent = useCallback((hex: string | null) => {
    const root = document.documentElement;
    if (!hex) {
      root.style.removeProperty("--color-accent");
      root.style.removeProperty("--color-accent-hover");
      root.style.removeProperty("--color-on-accent");
      try {
        localStorage.removeItem(ACCENT_STORAGE_KEY);
      } catch {}
      return;
    }
    root.style.setProperty("--color-accent", hex);
    root.style.setProperty("--color-accent-hover", hex);
    root.style.setProperty("--color-on-accent", "#ffffff");
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, hex);
    } catch {}
  }, []);

  const value = useMemo(() => ({ applyTheme, applyAccent }), [applyTheme, applyAccent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
