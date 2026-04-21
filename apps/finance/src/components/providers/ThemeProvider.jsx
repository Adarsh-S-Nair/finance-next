"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  const applyTheme = useCallback((theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
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

  const value = useMemo(() => ({ applyTheme, applyAccent }), [applyTheme, applyAccent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
