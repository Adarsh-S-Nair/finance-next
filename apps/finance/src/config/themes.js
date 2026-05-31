/**
 * Theme registry — the single source of truth for every selectable theme.
 *
 * Adding a new theme is a two-step change with NO logic edits:
 *   1. Add a `[data-theme="<id>"]` block in `src/styles/colors.css` that
 *      overrides the semantic `--color-*` variables (copy an existing block
 *      and tweak the values).
 *   2. Add an entry to the `THEMES` array below.
 *
 * Everything else — the provider that applies the theme, the appearance
 * picker in settings, the topbar toggle, and persistence to
 * `user_profiles.theme` — reads from this registry, so a new theme shows up
 * automatically wherever themes are listed.
 *
 * `appearance` ("light" | "dark") tells the rest of the app which family a
 * theme belongs to. The provider uses it to toggle the legacy `.dark` class
 * (a handful of Tailwind `dark:` utilities + the `.shimmer` rule still key
 * off it) and to set the native `color-scheme`. A future gray "dim" theme,
 * for example, would be `appearance: "dark"`.
 */

/**
 * @typedef {Object} ThemeDefinition
 * @property {string} id          Stored in `user_profiles.theme`; matches the
 *                                `[data-theme="<id>"]` selector in colors.css.
 * @property {string} label       Human-friendly name shown in the UI.
 * @property {"light"|"dark"} appearance  Light/dark family for this theme.
 * @property {{ bg: string, fg: string, accent: string }} swatch
 *                                Representative colors for preview chips.
 */

/** @type {ThemeDefinition[]} */
export const THEMES = [
  {
    id: "light",
    label: "Light",
    appearance: "light",
    swatch: { bg: "#ffffff", fg: "#18181b", accent: "#18181b" },
  },
  {
    id: "dark",
    label: "Dark",
    appearance: "dark",
    swatch: { bg: "#0d0d0d", fg: "#e4e4e7", accent: "#fafafa" },
  },
];

/** The theme used before a profile loads and on sign-out. */
export const DEFAULT_THEME_ID = "light";

/** Convenience list of valid theme ids. */
export const THEME_IDS = THEMES.map((t) => t.id);

/**
 * Resolve a stored theme id to its definition, falling back to the default
 * when the value is missing or unknown (e.g. a theme that was removed).
 * @param {string | null | undefined} id
 * @returns {ThemeDefinition}
 */
export function getTheme(id) {
  return (
    THEMES.find((t) => t.id === id) ||
    THEMES.find((t) => t.id === DEFAULT_THEME_ID) ||
    THEMES[0]
  );
}

/**
 * Normalize an arbitrary stored value to a known theme id.
 * @param {string | null | undefined} id
 * @returns {string}
 */
export function resolveThemeId(id) {
  return getTheme(id).id;
}

/**
 * Whether a theme belongs to the dark family.
 * @param {string | null | undefined} id
 * @returns {boolean}
 */
export function isDarkAppearance(id) {
  return getTheme(id).appearance === "dark";
}

/**
 * Apply a theme to the document — the single place that mutates <html>.
 * Sets `data-theme` (the primary selector colors.css keys off), keeps the
 * legacy `.dark` class in sync (a few Tailwind `dark:` utilities + the
 * `.shimmer` rule still rely on it), and sets the native `color-scheme`.
 *
 * Pure DOM, no React — safe to call from anywhere (the ThemeProvider, or
 * the always-light setup/auth screens that need to force a specific theme).
 * @param {string | null | undefined} id
 */
export function applyThemeToDocument(id) {
  if (typeof document === "undefined") return;
  const theme = getTheme(id);
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.classList.toggle("dark", theme.appearance === "dark");
  root.style.colorScheme = theme.appearance;
}
