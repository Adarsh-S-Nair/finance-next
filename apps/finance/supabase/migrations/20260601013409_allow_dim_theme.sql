-- Allow the new "dim" (softer gray dark) theme id in user_profiles.theme.
-- The original CHECK only permitted 'light' | 'dark' | 'system', so saving
-- the new theme was silently rejected and the UI reverted on refresh.
-- 'dark' is retained (it's the original pure-black "Ultra Dark" theme).
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_theme_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_theme_check
  CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'dim'::text, 'system'::text]));
