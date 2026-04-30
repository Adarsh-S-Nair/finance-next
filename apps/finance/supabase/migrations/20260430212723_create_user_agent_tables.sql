-- Personal AI agent: BYOK profile + chat conversations + messages.
--
-- Each user can configure their own LLM provider + API key (encrypted at
-- rest with the same AES-256-GCM scheme as Plaid tokens). The agent has
-- per-user conversations; each conversation has an ordered message log.
-- Tool calls and tool results live alongside text in `content` as JSONB
-- so we can store Anthropic-style content blocks without schema churn
-- when generative UI / tool use lands.

-- ---------------------------------------------------------------------------
-- Table: user_agent_profile
-- ---------------------------------------------------------------------------
create table if not exists public.user_agent_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_provider text not null default 'anthropic'
    check (ai_provider in ('anthropic')),
  ai_api_key_encrypted text null,
  ai_model text not null default 'claude-sonnet-4-5',
  custom_instructions text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_agent_profile_set_updated_at on public.user_agent_profile;
create trigger user_agent_profile_set_updated_at
  before update on public.user_agent_profile
  for each row execute function public.handle_updated_at();

comment on table public.user_agent_profile is 'Per-user AI agent configuration including BYOK API key (encrypted).';
comment on column public.user_agent_profile.ai_api_key_encrypted is 'AES-256-GCM ciphertext of the user-supplied API key. Decrypt server-side only.';

alter table public.user_agent_profile enable row level security;

drop policy if exists "user_agent_profile_select_own" on public.user_agent_profile;
create policy "user_agent_profile_select_own"
  on public.user_agent_profile for select
  using (user_id = auth.uid());

drop policy if exists "user_agent_profile_insert_own" on public.user_agent_profile;
create policy "user_agent_profile_insert_own"
  on public.user_agent_profile for insert
  with check (user_id = auth.uid());

drop policy if exists "user_agent_profile_update_own" on public.user_agent_profile;
create policy "user_agent_profile_update_own"
  on public.user_agent_profile for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_agent_profile_delete_own" on public.user_agent_profile;
create policy "user_agent_profile_delete_own"
  on public.user_agent_profile for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table: user_agent_conversations
-- ---------------------------------------------------------------------------
create table if not exists public.user_agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text null,
  summary text null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_agent_conversations_user_recent
  on public.user_agent_conversations (user_id, last_message_at desc);

comment on table public.user_agent_conversations is 'Per-user agent chat threads. Ordered by last_message_at desc.';
comment on column public.user_agent_conversations.summary is 'Rolling summary of older messages once they are pruned, to keep context coherent.';

alter table public.user_agent_conversations enable row level security;

drop policy if exists "user_agent_conversations_select_own" on public.user_agent_conversations;
create policy "user_agent_conversations_select_own"
  on public.user_agent_conversations for select
  using (user_id = auth.uid());

drop policy if exists "user_agent_conversations_insert_own" on public.user_agent_conversations;
create policy "user_agent_conversations_insert_own"
  on public.user_agent_conversations for insert
  with check (user_id = auth.uid());

drop policy if exists "user_agent_conversations_update_own" on public.user_agent_conversations;
create policy "user_agent_conversations_update_own"
  on public.user_agent_conversations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_agent_conversations_delete_own" on public.user_agent_conversations;
create policy "user_agent_conversations_delete_own"
  on public.user_agent_conversations for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table: user_agent_messages
-- ---------------------------------------------------------------------------
create table if not exists public.user_agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.user_agent_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  -- JSONB so we can store either { type: 'text', text: '...' } or
  -- Anthropic-style content blocks (text + tool_use + tool_result) when
  -- generative UI lands without a schema change.
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_agent_messages_conversation_time
  on public.user_agent_messages (conversation_id, created_at);

comment on table public.user_agent_messages is 'Ordered message log per conversation. content is JSONB to accommodate tool calls.';

alter table public.user_agent_messages enable row level security;

-- Messages don't carry user_id directly — they inherit via conversation_id.
-- The policy joins to confirm the conversation belongs to the caller.
drop policy if exists "user_agent_messages_select_own" on public.user_agent_messages;
create policy "user_agent_messages_select_own"
  on public.user_agent_messages for select
  using (
    exists (
      select 1 from public.user_agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "user_agent_messages_insert_own" on public.user_agent_messages;
create policy "user_agent_messages_insert_own"
  on public.user_agent_messages for insert
  with check (
    exists (
      select 1 from public.user_agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "user_agent_messages_delete_own" on public.user_agent_messages;
create policy "user_agent_messages_delete_own"
  on public.user_agent_messages for delete
  using (
    exists (
      select 1 from public.user_agent_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
