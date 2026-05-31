"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useUser } from "../providers/UserProvider";
import { THEMES, DEFAULT_THEME_ID, resolveThemeId } from "../../config/themes";

/**
 * A tiny schematic of the app, painted in a theme's real colors. It renders
 * inside a `[data-theme="<id>"]` subtree, so every `var(--color-*)` below
 * resolves to that theme's values straight from colors.css — no colors are
 * hardcoded or duplicated here. Adding a theme to the registry makes its
 * preview appear automatically.
 */
function ThemePreview({ themeId }) {
  return (
    <div
      data-theme={themeId}
      aria-hidden="true"
      className="pointer-events-none flex h-16 w-full gap-1.5 p-1.5"
      style={{ backgroundColor: "var(--color-shell-bg)" }}
    >
      {/* Sidebar with an accent tile */}
      <div
        className="flex w-4 flex-col items-center gap-1 rounded-md py-1.5"
        style={{ backgroundColor: "var(--color-sidebar-bg)", border: "1px solid var(--color-border)" }}
      >
        <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: "var(--color-accent)" }} />
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "var(--color-muted)" }} />
      </div>

      {/* Content card: bars + a success line */}
      <div
        className="flex flex-1 items-end gap-1 rounded-md p-1.5"
        style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <span className="h-1/3 flex-1 rounded-sm" style={{ backgroundColor: "var(--color-chart-spending-bar)" }} />
        <span className="h-2/3 flex-1 rounded-sm" style={{ backgroundColor: "var(--color-accent)" }} />
        <span className="h-1/2 flex-1 rounded-sm" style={{ backgroundColor: "var(--color-chart-spending-bar)" }} />
        <span className="h-3/4 flex-1 rounded-sm" style={{ backgroundColor: "var(--color-success)" }} />
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEMES.map((theme) => {
        const isActive = theme.id === activeId;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={theme.label}
            onClick={() => setTheme(theme.id)}
            className={[
              "group flex flex-col overflow-hidden rounded-xl border text-left transition-colors",
              isActive
                ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                : "border-[var(--color-border)] hover:border-[var(--color-ring)]",
            ].join(" ")}
          >
            <ThemePreview themeId={theme.id} />
            <div className="flex items-center justify-between border-t border-[var(--color-border)] px-2.5 py-2">
              <span className="text-xs font-medium text-[var(--color-fg)]">{theme.label}</span>
              {isActive ? <FiCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
