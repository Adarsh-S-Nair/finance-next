-- Persistent things the agent should remember about the user across
-- conversations. Loaded into the system prompt at the start of every
-- chat so the agent doesn't lose context between sessions.
--
-- The agent writes to this table via the remember_user_fact tool when
-- the user shares something durable (commitments paid from unconnected
-- accounts, preferences, household details). The user manages the list
-- via /settings/agent — they can delete anything they don't want
-- remembered.
--
-- Soft delete via is_active so we keep an audit trail (memories that
-- got "forgotten" don't leak back into prompts but stay queryable for
-- diagnostics). Hard delete handled at the user-deletion cascade.

create table if not exists public.user_agent_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- One short fact per row. Cap at 1000 chars to keep prompt
  -- accumulation under control; the model is told to keep memories
  -- under 200 chars in practice.
  content text not null check (length(content) > 0 and length(content) <= 1000),
  -- 'agent' = saved automatically via remember_user_fact tool;
  -- 'user'  = added manually via the settings UI. Lets the UI show
  -- different affordances per source ("the agent saved this" vs
  -- "you added this").
  source text not null default 'agent' check (source in ('agent', 'user')),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_user_agent_memories_user_active
  on public.user_agent_memories (user_id, is_active, created_at desc);

comment on table public.user_agent_memories is 'Persistent facts the agent remembers about the user across conversations.';
comment on column public.user_agent_memories.source is 'Where the memory came from: agent (auto-saved via tool) or user (added via UI).';

alter table public.user_agent_memories enable row level security;

drop policy if exists "user_agent_memories_select_own" on public.user_agent_memories;
create policy "user_agent_memories_select_own"
  on public.user_agent_memories for select
  using (user_id = auth.uid());

drop policy if exists "user_agent_memories_insert_own" on public.user_agent_memories;
create policy "user_agent_memories_insert_own"
  on public.user_agent_memories for insert
  with check (user_id = auth.uid());

drop policy if exists "user_agent_memories_update_own" on public.user_agent_memories;
create policy "user_agent_memories_update_own"
  on public.user_agent_memories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_agent_memories_delete_own" on public.user_agent_memories;
create policy "user_agent_memories_delete_own"
  on public.user_agent_memories for delete
  using (user_id = auth.uid());
