-- Add first_name and last_name columns to user_profiles
-- Names are also stored in auth.users user_metadata for quick access,
-- but having them in user_profiles allows easier server-side queries.

alter table public.user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

comment on column public.user_profiles.first_name is 'User''s first name, collected during onboarding.';
comment on column public.user_profiles.last_name is 'User''s last name, collected during onboarding (optional).';
