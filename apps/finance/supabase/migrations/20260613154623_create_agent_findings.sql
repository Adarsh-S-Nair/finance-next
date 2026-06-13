-- Agent findings: one row per thing the assistant surfaces (a detected
-- opportunity, anomaly, or FYI). Produced by deterministic detectors run
-- on a schedule; rendered by the dashboard assistant card and /today.
create table public.agent_findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Detector that produced it, e.g. 'subscription_price_increase'.
  type text not null,
  -- Drives the card color/label: act on it, look at it, or just know it.
  severity text not null check (severity in ('action', 'review', 'info')),
  title text not null,
  body text not null,
  -- Supporting data the finding is grounded in (the streams/txns/accounts
  -- that prove it) so the UI can show "why" without recomputing.
  evidence jsonb not null default '{}'::jsonb,
  -- Annualized dollar impact of acting, when quantifiable.
  value_annual numeric,
  -- Optional CTA descriptor, e.g. {"label": "Review subscription"}.
  suggested_action jsonb,
  -- The entity the finding is about (e.g. a recurring stream_id) — lets a
  -- detector update/resolve the same subject across runs.
  subject_id text,
  -- Stable key for idempotent upserts: re-running a sweep updates the same
  -- finding instead of duplicating it. Unique per user.
  dedupe_key text not null,
  status text not null default 'new' check (status in ('new', 'seen', 'acted', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, dedupe_key)
);

comment on table public.agent_findings is
  'Things the finance assistant surfaces for a user. One row per detected opportunity/anomaly/FYI, produced by deterministic detectors and rendered on the dashboard.';

create index agent_findings_user_status_idx
  on public.agent_findings (user_id, status, created_at desc);

alter table public.agent_findings enable row level security;

-- Detectors write through the service role (bypasses RLS). End users may
-- read their own findings and update their status (seen/dismissed).
create policy agent_findings_select_own on public.agent_findings
  for select using (auth.uid() = user_id);

create policy agent_findings_update_own on public.agent_findings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
