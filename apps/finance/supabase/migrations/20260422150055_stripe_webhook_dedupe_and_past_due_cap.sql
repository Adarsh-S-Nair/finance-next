-- Two things this migration adds, both defensive:
--
-- 1. `stripe_processed_events` table
--    Stripe retries webhooks whenever the handler returns a non-2xx (and
--    sometimes even on 2xx network flakes). Without dedupe we'll double-apply
--    any non-idempotent side effect. Key by Stripe event.id; the caller
--    inserts the row before doing the work and bails out on conflict.
--
-- 2. `user_profiles.past_due_since`
--    Currently `past_due` keeps Pro forever unless Stripe's dunning policy
--    eventually flips the sub to `unpaid`/`canceled` and we see a
--    subscription.updated or .deleted event. If dunning isn't configured the
--    user stays Pro indefinitely. This column is the server-side safety net:
--    the webhook stamps it on the `past_due` transition, and a cron sweeps
--    users stuck there past a grace window down to free.

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_processed_events is
  'Dedupes Stripe webhook events. Webhook handler inserts event.id before processing; conflict means already processed.';

-- No RLS needed — only the service role writes here from the webhook handler,
-- but enable RLS and leave with no policies so an anon-key client can't read
-- the table (defense in depth against an accidental anon.select).
alter table public.stripe_processed_events enable row level security;

-- Index for a future retention cron (delete events older than N days).
create index if not exists idx_stripe_processed_events_processed_at
  on public.stripe_processed_events (processed_at);

alter table public.user_profiles
  add column if not exists past_due_since timestamptz;

comment on column public.user_profiles.past_due_since is
  'When Stripe first reported past_due for this user. Cleared when the subscription returns to active, or when we downgrade the user after the grace window.';
