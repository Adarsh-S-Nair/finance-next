-- Cache for AI-curated dashboard insights. Generators produce
-- candidates from the user's data on every request (cheap), but the
-- LLM curator pass that filters + rewrites them into the 2-3 worth
-- showing is expensive enough that we don't want to repeat it on
-- every dashboard load.
--
-- Two invalidation triggers:
--   1. expires_at — TTL on the curated set (default ~6h). Keeps the
--      surface fresh without cost.
--   2. candidate_fingerprint — hash of the candidate set the curator
--      saw. If new generators emit different signals (transactions
--      synced, budget changed), the fingerprint moves and the cache
--      is treated as stale even within its TTL.
--
-- Single row per user (PK on user_id) — we only ever care about the
-- latest curated set.

create table if not exists public.user_agent_insight_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Curated Insight[] in the same shape the carousel renders. Stored
  -- as JSONB so the route can return it directly without re-parsing.
  insights jsonb not null,
  -- SHA-256 hex of the candidate set (kind + id + sorted context keys
  -- the curator saw). Lets us detect "underlying data changed" without
  -- needing to re-run the curator just to compare.
  candidate_fingerprint text not null,
  -- The model that produced this curation; lets us invalidate cleanly
  -- when the model is bumped without a schema change.
  model text not null,
  generated_at timestamptz not null default now(),
  -- TTL. The route treats `now() > expires_at` as stale and re-curates.
  expires_at timestamptz not null
);

create index if not exists idx_user_agent_insight_cache_expires
  on public.user_agent_insight_cache (expires_at);

comment on table public.user_agent_insight_cache is 'Per-user cache of LLM-curated dashboard insights, keyed on candidate fingerprint + TTL.';
comment on column public.user_agent_insight_cache.candidate_fingerprint is 'SHA-256 of the candidate set the curator saw; mismatch with current candidates marks the cache stale.';

alter table public.user_agent_insight_cache enable row level security;

-- Service role bypasses RLS, so the dashboard route works either way.
-- A select-own policy is here so the row is queryable by the user
-- directly if a future client-side fetch ever needs it (mirrors how
-- user_agent_memories is set up).
drop policy if exists "user_agent_insight_cache_select_own" on public.user_agent_insight_cache;
create policy "user_agent_insight_cache_select_own"
  on public.user_agent_insight_cache for select
  using (user_id = auth.uid());
