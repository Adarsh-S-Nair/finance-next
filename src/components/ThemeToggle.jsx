"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";

export default function ThemeToggle() {
  const { profile, setTheme, loading } = useUser();
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (profile?.theme === 'dark' || profile?.theme === 'light') {
      setDark(profile.theme === 'dark');
    } else if (!loading && !profile) {
      // Default to light theme for non-authenticated users
      setDark(false);
    }
  }, [profile?.theme, loading]);

  const toggle = () => {
    console.log("[ThemeToggle] toggle", { before: dark, after: !dark });
    const next = !dark;
    setDark(next);
    setTheme(next ? 'dark' : 'light');
  };

  if (!mounted) return null;

  return (
    <button type="button" aria-label="Toggle theme" onClick={toggle} className="mr-4 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
      <span className="relative inline-flex h-6 w-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] transition-colors duration-200 group-hover:bg-[color-mix(in_oklab,var(--color-accent),black_8%)]">
        <span
          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] transition-transform duration-200 will-change-transform group-hover:shadow"
          style={{ transform: dark ? 'translateX(22px)' : 'translateX(0px)' }}
        />
      </span>
    </button>
  );
}


