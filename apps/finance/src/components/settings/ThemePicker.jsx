"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { useUser } from "../providers/UserProvider";
import { THEMES, DEFAULT_THEME_ID, resolveThemeId } from "../../config/themes";

/**
 * A small but recognizable sample dashboard, painted in a theme's real
 * colors. It renders inside a `[data-theme="<id>"]` subtree, so every
 * `var(--color-*)` below resolves to that theme's values straight from
 * colors.css — no colors are hardcoded or duplicated here. Adding a new
 * theme to the registry makes its preview appear automatically.
 *
 * Kept intentionally schematic: a sidebar, a header with an accent action,
 * a tiny bar chart, two stat tiles, and a list row — enough to read the
 * theme at a glance without trying to be the actual app.
 */
function ThemePreview({ themeId }) {
  // Static heights so every theme's chart looks identical (only colors vary).
  const bars = [40, 70, 45, 90, 60, 80];

  return (
    <div
      data-theme={themeId}
      aria-hidden="true"
      className="pointer-events-none flex h-32 w-full gap-2 overflow-hidden p-2"
      style={{ backgroundColor: "var(--color-shell-bg)" }}
    >
      {/* Sidebar */}
      <div
        className="flex w-7 flex-col items-center gap-2 rounded-lg py-2"
        style={{
          backgroundColor: "var(--color-sidebar-bg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span
          className="h-3 w-3 rounded-md"
          style={{ backgroundColor: "var(--color-accent)" }}
        />
        <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-fg)" }} />
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-muted)" }} />
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-muted)" }} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-2">
        {/* Header row: title + accent button */}
        <div className="flex items-center justify-between">
          <span
            className="h-2 w-16 rounded-full"
            style={{ backgroundColor: "var(--color-fg)" }}
          />
          <span
            className="h-3.5 w-9 rounded-md"
            style={{ backgroundColor: "var(--color-accent)" }}
          />
        </div>

        {/* Chart + stats card */}
        <div
          className="flex flex-1 gap-2 rounded-lg p-2"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Mini bar chart */}
          <div className="flex flex-[1.4] items-end gap-1">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  backgroundColor:
                    i === 3 ? "var(--color-accent)" : "var(--color-chart-spending-bar)",
                }}
              />
            ))}
          </div>

          {/* Stat tiles */}
          <div className="flex flex-1 flex-col gap-1.5">
            <div
              className="flex flex-col gap-1 rounded-md p-1.5"
              style={{ backgroundColor: "var(--color-surface-alt)" }}
            >
              <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--color-muted)" }} />
              <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: "var(--color-fg)" }} />
            </div>
            <div
              className="flex items-center gap-1 rounded-md p-1.5"
              style={{ backgroundColor: "var(--color-surface-alt)" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-success)" }} />
              <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: "var(--color-success)" }} />
            </div>
          </div>
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all",
              isActive
                ? "border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]"
                : "border-[var(--color-border)] hover:border-[var(--color-ring)]",
            ].join(" ")}
          >
            <ThemePreview themeId={theme.id} />

            {/* Caption bar */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {theme.label}
                </span>
                {theme.description ? (
                  <span className="text-xs text-[var(--color-muted)]">
                    {theme.description}
                  </span>
                ) : null}
              </div>
              <span
                className={[
                  "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                  isActive
                    ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                    : "border border-[var(--color-border)] text-transparent",
                ].join(" ")}
              >
                <FiCheck className="h-3 w-3" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
