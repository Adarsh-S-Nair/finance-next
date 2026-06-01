-- Theme ids are now defined by the app's registry (src/config/themes.js),
-- not an enumerated DB list. Replace the value-list CHECK with a loose
-- format check so adding a new theme is just CSS + a registry entry — no
-- migration needed each time. Unknown/stale values degrade gracefully:
-- the client normalizes them to the default theme via resolveThemeId().
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_theme_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_theme_check
  CHECK (theme ~ '^[a-z][a-z0-9_-]{0,31}$');
