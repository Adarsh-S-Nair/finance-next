"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useUser } from "../providers/UserProvider";
import { THEMES, DEFAULT_THEME_ID, resolveThemeId } from "../../config/themes";

/**
 * Miniature of the app chrome (floating sidebar + content card) painted in a
 * theme's real colors, so each option previews how the app actually looks
 * rather than just naming the theme. Pure inline styles from the swatch — it
 * deliberately doesn't use the live `--color-*` vars so every preview shows
 * its own theme regardless of which one is currently active.
 */
function ThemePreview({ swatch }) {
  return (
    <div
      className="flex h-20 w-full gap-1.5 overflow-hidden rounded-lg p-1.5"
      style={{ backgroundColor: swatch.shell }}
      aria-hidden="true"
    >
      {/* Floating sidebar pill */}
      <div
        className="flex w-4 flex-col items-center gap-1 rounded-md py-1.5"
        style={{ backgroundColor: swatch.sidebar, border: `1px solid ${swatch.border}` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: swatch.accent }} />
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: swatch.muted }} />
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: swatch.muted }} />
      </div>

      {/* Content card */}
      <div
        className="flex flex-1 flex-col gap-1.5 rounded-md p-1.5"
        style={{ backgroundColor: swatch.surface, border: `1px solid ${swatch.border}` }}
      >
        {/* Title + accent action */}
        <div className="flex items-center justify-between">
          <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: swatch.fg }} />
          <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: swatch.accent }} />
        </div>
        {/* Body lines */}
        <span className="h-1 w-full rounded-full" style={{ backgroundColor: swatch.muted, opacity: 0.6 }} />
        <span className="h-1 w-3/4 rounded-full" style={{ backgroundColor: swatch.muted, opacity: 0.6 }} />
        {/* Mini stat tiles */}
        <div className="mt-auto flex gap-1">
          <span className="h-3 flex-1 rounded-sm" style={{ backgroundColor: swatch.shell, border: `1px solid ${swatch.border}` }} />
          <span className="h-3 flex-1 rounded-sm" style={{ backgroundColor: swatch.shell, border: `1px solid ${swatch.border}` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Theme selector driven entirely by the registry in `src/config/themes.js`.
 * Every theme defined there renders as a selectable preview card here —
 * adding a new theme requires no changes to this component.
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
              "group relative flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors",
              isActive
                ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                : "border-[var(--color-border)] hover:border-[var(--color-ring)]",
            ].join(" ")}
          >
            <ThemePreview swatch={theme.swatch} />

            <div className="flex items-center justify-between px-1">
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
