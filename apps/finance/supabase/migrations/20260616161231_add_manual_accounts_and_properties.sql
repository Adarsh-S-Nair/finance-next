-- Manual (non-Plaid) accounts + property/real-estate tracking.
--
-- Part A: let the accounts table hold user-created manual rows. Property is
-- the first consumer, but the is_manual flag + relaxed Plaid columns are
-- reusable for any future manual asset (vehicles, valuables, cash).
--
-- Plaid-linked rows still populate item_id/account_id/access_token; manual
-- rows leave them null. The existing unique index on (item_id, account_id)
-- treats NULLs as distinct, so multiple manual rows never collide.

alter table public.accounts alter column item_id drop not null;
alter table public.accounts alter column account_id drop not null;
alter table public.accounts alter column access_token drop not null;

alter table public.accounts
  add column if not exists is_manual boolean not null default false;

comment on column public.accounts.is_manual is
  'True for user-created manual accounts (e.g. property) not linked to Plaid. Plaid sync never touches these.';

-- Part B: properties sidecar. One row per real-estate asset, keyed to its
-- accounts row (which holds the current value in balances.current and counts
-- as an asset in net worth automatically). Mirrors the liabilities sidecar
-- pattern. linked_mortgage_account_id ties the home to an existing (often
-- Plaid-synced) mortgage account so the UI can show equity = value - mortgage
-- while net worth keeps counting the two halves independently.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  address text,
  purchase_price numeric,
  purchase_date date,

  -- 'manual' today; reserves room for 'avm' (live estimate) | 'model'
  -- (appreciation model) without another migration.
  value_source text not null default 'manual',

  -- Optional FK to the mortgage liability account backing this property.
  -- ON DELETE SET NULL so unlinking/deleting the mortgage doesn't cascade
  -- away the property asset.
  linked_mortgage_account_id uuid references public.accounts(id) on delete set null,

  value_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (account_id)
);

create index if not exists properties_user_id_idx on public.properties (user_id);

alter table public.properties enable row level security;

drop policy if exists "users can read own properties" on public.properties;
create policy "users can read own properties"
  on public.properties for select
  using (auth.uid() = user_id);

drop policy if exists "users can write own properties" on public.properties;
create policy "users can write own properties"
  on public.properties for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.handle_updated_at();

comment on table public.properties is
  'Real-estate assets. The asset value lives on the linked accounts row; this sidecar holds purchase info, address, value source, and the optional linked mortgage account.';
comment on column public.properties.linked_mortgage_account_id is
  'Optional FK to the mortgage liability account backing this property, for equity display.';
comment on column public.properties.value_source is
  'How the current value is determined: manual | avm | model. Only manual is implemented today.';
