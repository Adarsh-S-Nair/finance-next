-- Platform-wide config managed from the admin app: API keys, model
-- selections, and other server-side knobs that we want to change without
-- redeploys. Secrets are encrypted at rest with the same AES-256-GCM
-- scheme used for Plaid tokens (PLAID_TOKEN_ENCRYPTION_KEY).
--
-- Access pattern:
--   - Admin app reads/writes via service role + ADMIN_EMAILS gating in
--     the API route.
--   - Finance app reads via service role from server-side routes only
--     (e.g. /api/agent/chat).
--   - No anon/authed-client policy is granted — RLS denies everything,
--     and only service-role calls go through.

create table if not exists public.platform_config (
  key text primary key,
  value text not null,
  is_secret boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

drop trigger if exists platform_config_set_updated_at on public.platform_config;
create trigger platform_config_set_updated_at
  before update on public.platform_config
  for each row execute function public.handle_updated_at();

comment on table public.platform_config is 'Admin-managed key/value config (API keys, model selection, ...). Secrets encrypted with PLAID_TOKEN_ENCRYPTION_KEY.';
comment on column public.platform_config.is_secret is 'When true, value is AES-256-GCM ciphertext with v1: prefix.';

alter table public.platform_config enable row level security;
-- No policies on purpose: only service-role calls (admin API + finance
-- chat route) should ever touch this table. Adding a policy would be a
-- foot-gun.
