"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Segmented light/dark toggle used on the Settings page. Rendered client-side
 * so it can read/mutate the html.dark class. We gate on a mount flag to avoid
 * hydration warnings about SSR-defaulted state.
 */
export function ThemeControls() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-[140px] rounded-full bg-[var(--color-fg)]/[0.05]" aria-hidden />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-fg)]/[0.05] p-1"
    >
      <Option
        label="Light"
        icon={<FiSun className="h-3.5 w-3.5" />}
        active={theme === "light"}
        onClick={() => setTheme("light")}
      />
      <Option
        label="Dark"
        icon={<FiMoon className="h-3.5 w-3.5" />}
        active={theme === "dark"}
        onClick={() => setTheme("dark")}
      />
    </div>
  );
}

function Option({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
