-- Add onboarding_step column to user_profiles
-- Tracks where the user left off in the FTUX onboarding flow so they can resume.
-- Step values: 0=email/password (pre-auth), 1=name, 2=account type, 3=connecting, 4=connected
-- NULL or absent means onboarding not started or already completed.

alter table public.user_profiles
  add column if not exists onboarding_step smallint;

comment on column public.user_profiles.onboarding_step is 'Current FTUX onboarding step (1-4). NULL when onboarding is complete.';
