-- Add Stripe billing fields to user_profiles
-- stripe_customer_id: the Stripe customer ID for this user
-- subscription_status: mirrors the Stripe subscription status (active, canceled, past_due, etc.)

alter table public.user_profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists subscription_status text;

comment on column public.user_profiles.stripe_customer_id is 'Stripe customer ID — used to look up this user in Stripe.';
comment on column public.user_profiles.subscription_status is 'Mirrors the Stripe subscription status: active, canceled, past_due, trialing, etc.';

-- Index for fast webhook lookups by stripe_customer_id
create index if not exists idx_user_profiles_stripe_customer_id
  on public.user_profiles (stripe_customer_id);
