-- Tracks the user's response to inline widgets the agent renders
-- (currently the recategorization confirmation widget; future: budget
-- proposal widgets, etc).
--
-- Each widget instance is identified by Anthropic's `tool_use_id`, which
-- is unique per tool call within a conversation. The widget reads this
-- table on mount to know whether the user already accepted/declined the
-- proposal in a previous session — without it, reloading the page would
-- show the proposal again and let the user re-act on something they've
-- already decided.
--
-- Why a separate table instead of mutating user_agent_messages content:
-- the message log is treated as immutable conversation history. Tool
-- results stored there are a snapshot from when the tool ran; the
-- user's response is a separate event that can arrive later (or never,
-- if they ignore it). Keeping it side-by-side preserves the cleanness
-- of the message stream.

create table if not exists public.user_agent_widget_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Anthropic-supplied tool_use_id, e.g. "toolu_01ABC...". Globally
  -- unique within a user; we don't reference it as a FK because the
  -- tool_use lives inside a JSONB blob in user_agent_messages.content.
  tool_use_id text not null,
  action text not null check (action in ('accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (user_id, tool_use_id)
);

create index if not exists idx_user_agent_widget_actions_user_tool
  on public.user_agent_widget_actions (user_id, tool_use_id);

comment on table public.user_agent_widget_actions is 'Persistent record of accept/decline actions on inline agent widgets, keyed by Anthropic tool_use_id.';

alter table public.user_agent_widget_actions enable row level security;

drop policy if exists "user_agent_widget_actions_select_own" on public.user_agent_widget_actions;
create policy "user_agent_widget_actions_select_own"
  on public.user_agent_widget_actions for select
  using (user_id = auth.uid());

drop policy if exists "user_agent_widget_actions_insert_own" on public.user_agent_widget_actions;
create policy "user_agent_widget_actions_insert_own"
  on public.user_agent_widget_actions for insert
  with check (user_id = auth.uid());

drop policy if exists "user_agent_widget_actions_update_own" on public.user_agent_widget_actions;
create policy "user_agent_widget_actions_update_own"
  on public.user_agent_widget_actions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_agent_widget_actions_delete_own" on public.user_agent_widget_actions;
create policy "user_agent_widget_actions_delete_own"
  on public.user_agent_widget_actions for delete
  using (user_id = auth.uid());
