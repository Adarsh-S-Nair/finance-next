"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import { FiSun, FiMoon } from "react-icons/fi";

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
    const next = !dark;
    setDark(next);
    setTheme(next ? 'dark' : 'light');
  };

  if (!mounted) return <div className="w-10 h-10" />;

  return (
    <button 
      type="button" 
      aria-label="Toggle theme" 
      onClick={toggle} 
      className="relative mr-4 flex h-8 w-14 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-300 hover:border-[var(--color-neon-blue)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-neon-blue)]"
    >
      <div className="absolute inset-0 rounded-full opacity-20 bg-gradient-to-r from-[var(--color-neon-blue)] to-[var(--color-neon-purple)]" />
      <span 
        className={`
          absolute left-1 flex h-6 w-6 items-center justify-center rounded-full 
          bg-gradient-to-br from-[var(--color-bg)] to-[var(--color-surface)] 
          shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-[var(--color-border)]
          transition-all duration-300 will-change-transform
          ${dark ? 'translate-x-6 border-[var(--color-neon-blue)] shadow-[0_0_10px_var(--color-neon-blue)]' : 'translate-x-0 border-[var(--color-warn)]'}
        `}
      >
        {dark ? (
          <FiMoon className="h-3 w-3 text-[var(--color-neon-blue)]" />
        ) : (
          <FiSun className="h-3 w-3 text-[var(--color-warn)]" />
        )}
      </span>
    </button>
  );
}
