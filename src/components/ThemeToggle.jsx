"use client";

import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";

export default function ThemeToggle() {
  const { profile, setTheme } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9 rounded-full bg-[var(--color-surface-alt)] animate-pulse" />;
  }

  const currentTheme = profile?.theme || 'light';
  const isDark = currentTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
    >
      {isDark ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
    </button>
  );
}
