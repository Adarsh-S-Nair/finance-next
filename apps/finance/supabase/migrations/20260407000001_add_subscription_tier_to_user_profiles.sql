-- Add subscription_tier column to user_profiles.
-- This column was referenced in application code but never formally added
-- via migration. It stores the resolved tier ('free' or 'pro') and defaults
-- to 'free' for all existing and new rows.

alter table public.user_profiles
  add column if not exists subscription_tier text not null default 'free';

comment on column public.user_profiles.subscription_tier is
  'Resolved subscription tier: free or pro. Set by Stripe webhook on subscription changes.';
