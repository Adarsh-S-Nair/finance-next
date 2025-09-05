"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme.dark') === '1';
    const isDark = saved || (!localStorage.getItem('theme.dark') && prefers);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme.dark', next ? '1' : '0');
  };

  return (
    <button type="button" aria-label="Toggle theme" onClick={toggle} className="mr-4 cursor-pointer">
      <span className="relative inline-flex h-6 w-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-200">
        {/* Thumb with icon */}
        <span
          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] transition-transform duration-200 will-change-transform"
          style={{ transform: dark ? 'translateX(22px)' : 'translateX(0px)' }}
        >
          {dark ? (
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          ) : (
            <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5a1 1 0 011 1V7a1 1 0 11-2 0V5.5a1 1 0 011-1zm0 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM18.5 11a1 1 0 110 2H16a1 1 0 110-2h2.5zM9 12a1 1 0 01-1 1H5.5a1 1 0 110-2H8a1 1 0 011 1z"/></svg>
          )}
        </span>
      </span>
    </button>
  );
}


