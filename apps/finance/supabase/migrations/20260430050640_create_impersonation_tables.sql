-- Impersonation: lets an admin (requester) ask a user (target) for
-- temporary "log in as me" access. The target approves/denies in their
-- finance app; on approval the admin gets a one-time link that mints a
-- Supabase session for the target with a separate `impersonator` cookie
-- gating destructive actions.
--
-- impersonation_grants: one row per request lifecycle (pending →
-- approved/denied → revoked/expired).
-- impersonation_sessions: one row per "enter session" click — the audit
-- trail visible to both target and requester.

create table public.impersonation_grants (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'denied', 'revoked', 'expired'
  )),
  reason text,
  duration_seconds int not null default 86400,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index impersonation_grants_target_idx
  on public.impersonation_grants (target_user_id, status, requested_at desc);
create index impersonation_grants_requester_idx
  on public.impersonation_grants (requester_id, status, requested_at desc);

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.impersonation_grants(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index impersonation_sessions_grant_idx
  on public.impersonation_sessions (grant_id, started_at desc);
create index impersonation_sessions_target_idx
  on public.impersonation_sessions (target_user_id, started_at desc);

alter table public.impersonation_grants enable row level security;
alter table public.impersonation_sessions enable row level security;

-- Target can view + update (approve/deny/revoke) their own grants.
create policy "target_can_view_own_grants"
  on public.impersonation_grants for select
  using (auth.uid() = target_user_id);

create policy "target_can_update_own_grants"
  on public.impersonation_grants for update
  using (auth.uid() = target_user_id)
  with check (auth.uid() = target_user_id);

-- Requester can view their outgoing grants. They cannot directly write —
-- inserts/state changes go through the admin proxy → finance API → service
-- role, so server code controls the lifecycle.
create policy "requester_can_view_own_grants"
  on public.impersonation_grants for select
  using (auth.uid() = requester_id);

-- Sessions are read-only audit. Target + requester can see their own.
create policy "target_can_view_own_sessions"
  on public.impersonation_sessions for select
  using (auth.uid() = target_user_id);

create policy "requester_can_view_own_sessions"
  on public.impersonation_sessions for select
  using (auth.uid() = requester_id);
