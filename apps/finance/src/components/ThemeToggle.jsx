"use client";

import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { THEMES, DEFAULT_THEME_ID, isDarkAppearance } from "../config/themes";

// Quick topbar switch between the light and dark families. The actual ids
// come from the registry so this keeps working as themes are added; the
// fuller per-theme picker lives in Settings → Appearance.
const FIRST_LIGHT = THEMES.find((t) => t.appearance === "light")?.id || DEFAULT_THEME_ID;
const FIRST_DARK = THEMES.find((t) => t.appearance === "dark")?.id || DEFAULT_THEME_ID;

export default function ThemeToggle() {
  const { profile, setTheme } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9 rounded-full bg-[var(--color-surface-alt)] animate-pulse" />;
  }

  const isDark = isDarkAppearance(profile?.theme || DEFAULT_THEME_ID);

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? FIRST_LIGHT : FIRST_DARK)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
    >
      {isDark ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
    </button>
  );
}
