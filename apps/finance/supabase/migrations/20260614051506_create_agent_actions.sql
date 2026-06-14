-- Agent actions: an audit + undo ledger for writes the assistant makes
-- autonomously on a user's behalf (e.g. the scheduled sweep filling in an
-- uncategorized transaction). One row per action, carrying the pre-change
-- state so any action can be reverted generically, plus the reason so the
-- weekly digest can explain what happened. Proposals live in
-- agent_findings; this table is strictly things the agent *did*.
create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- What the agent did, e.g. 'categorize_transaction'. Extensible.
  action_type text not null,
  -- 'shadow'  : recorded but not written (dry run, for calibration)
  -- 'applied' : written to the subject row
  -- 'reverted': previously applied, then undone
  status text not null default 'applied'
    check (status in ('shadow', 'applied', 'reverted')),
  -- The row the action touched, addressed generically so one undo path
  -- works for any action type.
  subject_table text not null,
  subject_id text not null,
  -- Field values before the change -- what revert restores.
  previous_state jsonb not null default '{}'::jsonb,
  -- Field values the action set.
  new_state jsonb not null default '{}'::jsonb,
  -- Human-readable justification for the digest/undo UI, e.g.
  -- "matched 6 prior charges from 'Spotify' categorized as Music".
  reason text,
  -- 0..1 confidence behind the decision, for calibration + thresholding.
  confidence numeric,
  -- Where the action originated, e.g. 'cron-sweep'.
  source text,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

comment on table public.agent_actions is
  'Audit + undo ledger for autonomous writes the finance assistant makes on a user''s behalf. One row per action, carrying pre-change state for generic revert. Proposals live in agent_findings; this is strictly things the agent did.';

-- The digest and undo UI list a user's recent actions newest-first.
create index agent_actions_user_created_idx
  on public.agent_actions (user_id, created_at desc);

-- Fast lookup of the action(s) that touched a given row (e.g. to show
-- "categorized by assistant" provenance on a transaction, or to revert).
create index agent_actions_subject_idx
  on public.agent_actions (subject_table, subject_id);

alter table public.agent_actions enable row level security;

-- The agent writes through the service role (bypasses RLS). End users may
-- read their own action history and revert (update status) their own rows.
create policy agent_actions_select_own on public.agent_actions
  for select using (auth.uid() = user_id);

create policy agent_actions_update_own on public.agent_actions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
