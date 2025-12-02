"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Dropdown from "./ui/Dropdown";

export default function ThemeToggle() {
  const { profile, setTheme, loading } = useUser();
  const [mounted, setMounted] = useState(false);

  // Determine current theme
  const currentTheme = profile?.theme || 'light';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-24 h-8 bg-[var(--color-surface)] rounded-md animate-pulse" />;

  const options = [
    {
      label: 'Light',
      onClick: () => setTheme('light'),
      disabled: currentTheme === 'light'
    },
    {
      label: 'Dark',
      onClick: () => setTheme('dark'),
      disabled: currentTheme === 'dark'
    },
  ];

  const currentLabel = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);

  return (
    <Dropdown
      label={currentLabel}
      items={options}
      align="right"
      size="sm"
      className="w-24"
    />
  );
}
