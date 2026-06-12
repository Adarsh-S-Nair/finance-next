"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { applyThemeToDocument } from "../../config/themes";

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
  }, []);

  const applyAccent = useCallback((hex: string | null) => {
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

  const value = useMemo(() => ({ applyTheme, applyAccent }), [applyTheme, applyAccent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
