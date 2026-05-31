"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useUser } from "../providers/UserProvider";
import { THEMES, DEFAULT_THEME_ID, resolveThemeId } from "../../config/themes";

/**
 * Theme selector driven entirely by the registry in `src/config/themes.js`.
 * Every theme defined there renders as a selectable card here — adding a new
 * theme requires no changes to this component.
 */
export default function ThemePicker() {
  const { profile, setTheme } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeId = mounted ? resolveThemeId(profile?.theme || DEFAULT_THEME_ID) : null;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {THEMES.map((theme) => {
        const isActive = theme.id === activeId;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(theme.id)}
            className={[
              "group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
              isActive
                ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                : "border-[var(--color-border)] hover:border-[var(--color-ring)]",
            ].join(" ")}
          >
            {/* Preview swatch — a miniature of the theme's bg / fg / accent. */}
            <div
              className="flex h-14 w-full items-center justify-between overflow-hidden rounded-lg border border-[var(--color-border)] px-2"
              style={{ backgroundColor: theme.swatch.bg }}
            >
              <span
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: theme.swatch.accent }}
              />
              <span
                className="h-2 w-10 rounded-full"
                style={{ backgroundColor: theme.swatch.fg, opacity: 0.85 }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-fg)]">
                {theme.label}
              </span>
              {isActive ? (
                <FiCheck className="h-4 w-4 text-[var(--color-accent)]" />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
