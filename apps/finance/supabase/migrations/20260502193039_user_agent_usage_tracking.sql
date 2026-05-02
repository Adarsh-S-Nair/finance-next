-- Per-call usage detail. One row per Anthropic API round-trip (so a
-- single user message that triggers N tool iterations writes N rows).
-- Cascades freely with conversation/message deletion: lifetime totals
-- live in user_agent_usage_totals and are accumulated via trigger on
-- INSERT, so detail rows can disappear without losing the cost record.
create table if not exists public.user_agent_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.user_agent_conversations(id) on delete cascade,
  message_id uuid references public.user_agent_messages(id) on delete cascade,
  model text not null,
  input_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists user_agent_usage_user_created_idx
  on public.user_agent_usage (user_id, created_at desc);
create index if not exists user_agent_usage_conversation_idx
  on public.user_agent_usage (conversation_id)
  where conversation_id is not null;

-- Per-user lifetime totals, keyed by model so cost math stays accurate
-- across model switches (Haiku → Sonnet etc). Bigint counters because
-- these accumulate forever.
create table if not exists public.user_agent_usage_totals (
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  input_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  turns int not null default 0,
  first_used_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (user_id, model)
);

-- Accumulate on INSERT (not DELETE) so totals are correct the instant
-- the row lands, and don't depend on a delete trigger that wouldn't
-- fire on truncate / manual delete from / cascade in some configs.
create or replace function public.bump_agent_usage_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_agent_usage_totals (
    user_id, model,
    input_tokens, cache_read_tokens, cache_write_tokens, output_tokens,
    turns, first_used_at, last_used_at
  )
  values (
    new.user_id, new.model,
    new.input_tokens, new.cache_read_tokens, new.cache_write_tokens, new.output_tokens,
    1, new.created_at, new.created_at
  )
  on conflict (user_id, model) do update set
    input_tokens       = public.user_agent_usage_totals.input_tokens       + excluded.input_tokens,
    cache_read_tokens  = public.user_agent_usage_totals.cache_read_tokens  + excluded.cache_read_tokens,
    cache_write_tokens = public.user_agent_usage_totals.cache_write_tokens + excluded.cache_write_tokens,
    output_tokens      = public.user_agent_usage_totals.output_tokens      + excluded.output_tokens,
    turns              = public.user_agent_usage_totals.turns + 1,
    last_used_at       = greatest(public.user_agent_usage_totals.last_used_at, excluded.last_used_at);
  return new;
end
$$;

drop trigger if exists trg_bump_agent_usage_totals on public.user_agent_usage;
create trigger trg_bump_agent_usage_totals
after insert on public.user_agent_usage
for each row execute function public.bump_agent_usage_totals();

-- RLS. Service role (used by both finance chat route and admin queries)
-- bypasses RLS, so we only need user-facing SELECT policies for any
-- future user-side surface. No INSERT/UPDATE/DELETE policies — those
-- run server-side via service role only.
alter table public.user_agent_usage enable row level security;
alter table public.user_agent_usage_totals enable row level security;

create policy "users can read their own agent usage"
  on public.user_agent_usage
  for select
  using (auth.uid() = user_id);

create policy "users can read their own agent usage totals"
  on public.user_agent_usage_totals
  for select
  using (auth.uid() = user_id);

comment on table public.user_agent_usage is
  'Per-API-call usage detail. Cascades with conversation/message deletion. Lifetime totals are accumulated via trigger into user_agent_usage_totals and survive cascade.';
comment on table public.user_agent_usage_totals is
  'Per-(user, model) lifetime token counters. Accumulated by trigger on insert into user_agent_usage. Used for cost reporting in admin.';
