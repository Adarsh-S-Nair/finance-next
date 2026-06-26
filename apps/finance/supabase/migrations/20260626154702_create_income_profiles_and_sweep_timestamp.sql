-- income_profiles: one canonical income summary per user, computed by the
-- nightly sweep (source 'algorithm') and optionally refined by the
-- assistant (source 'assistant'). The dashboard's "Next paycheck" card
-- reads this instead of guessing from Plaid's unreliable recurring streams.
create table public.income_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Who last wrote this: the deterministic algorithm or the AI assistant.
  source text not null default 'algorithm' check (source in ('algorithm', 'assistant')),
  -- Best-effort employer/source label for the primary paycheck.
  employer text,
  -- WEEKLY | BIWEEKLY | SEMIMONTHLY | MONTHLY | IRREGULAR (null if none).
  cadence text,
  -- The primary paycheck's typical recent amount + last/next deposit.
  expected_amount numeric(12,2),
  last_amount numeric(12,2),
  last_date date,
  next_date date,
  -- All recurring income normalised to a monthly figure.
  monthly_income numeric(12,2),
  -- 0..1 confidence in the primary paycheck detection.
  confidence numeric(4,3),
  -- Full detected stream list + excluded items, for the card + audit.
  streams jsonb not null default '[]'::jsonb,
  excluded jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.income_profiles is
  'Per-user income summary (primary paycheck + all recurring income streams) computed by the nightly sweep and optionally refined by the assistant. Source of truth for the Next paycheck card.';

alter table public.income_profiles enable row level security;

-- Written server-side via the service role (bypasses RLS). Users may read
-- their own profile.
create policy income_profiles_select_own on public.income_profiles
  for select using (auth.uid() = user_id);

-- A faithful "the assistant swept at" timestamp, stamped every run
-- regardless of whether any finding changed. The findings card's
-- "Checked …" line reads this; previously it used max(updated_at) across
-- findings, which went stale on quiet nights even though the sweep ran.
alter table public.user_profiles
  add column if not exists agent_last_swept_at timestamptz;
