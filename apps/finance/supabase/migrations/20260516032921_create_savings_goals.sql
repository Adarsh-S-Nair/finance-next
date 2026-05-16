-- Savings goals + sub-budget line items.
-- Each goal is an abstract allocation against the user's total liquid
-- cash (sum of depository balances). The "emergency fund" goal is a
-- protected one that fills before any unprotected goal in the priority
-- waterfall.

create table if not exists public.savings_goals (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Identity
  name text not null,
  kind text not null default 'custom' check (kind in ('custom', 'emergency_fund')),

  -- Targets
  target_amount numeric(12, 2) not null check (target_amount > 0),
  target_date date,

  -- Priority + status
  priority integer not null default 0,
  status text not null default 'active' check (status in ('active', 'complete', 'archived')),
  is_protected boolean not null default false,

  -- Display
  color text not null default '#64748b',
  icon text,

  -- Emergency-fund-only metadata. Null for custom goals.
  --   ef_multiplier: how many months of runway the user picked.
  --   excluded_essential_category_ids: system_categories IDs the user
  --     opted out of from the auto-calculated essentials baseline
  --     (e.g. BNPL, a one-off Insomnia Cookies splurge categorized
  --     as Other F&D, etc.).
  ef_multiplier integer,
  excluded_essential_category_ids uuid[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint savings_goals_pkey primary key (id)
);

-- One active emergency fund per user. Partial unique index so a user
-- can have an archived/completed EF and a new active one in parallel.
create unique index if not exists savings_goals_one_active_ef_per_user
  on public.savings_goals (user_id)
  where kind = 'emergency_fund' and status = 'active';

-- Primary query path: list user's active goals in priority order.
create index if not exists idx_savings_goals_user_status_priority
  on public.savings_goals (user_id, status, priority);

alter table public.savings_goals enable row level security;

drop policy if exists "Users can view own savings goals" on public.savings_goals;
create policy "Users can view own savings goals"
  on public.savings_goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own savings goals" on public.savings_goals;
create policy "Users can insert own savings goals"
  on public.savings_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own savings goals" on public.savings_goals;
create policy "Users can update own savings goals"
  on public.savings_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own savings goals" on public.savings_goals;
create policy "Users can delete own savings goals"
  on public.savings_goals for delete
  using (auth.uid() = user_id);

drop trigger if exists savings_goals_set_updated_at on public.savings_goals;
create trigger savings_goals_set_updated_at
  before update on public.savings_goals
  for each row execute function public.handle_updated_at();

-- Sub-budget line items (e.g. a Trip goal split into Flights/Hotel/Food).
-- Don't carry user_id; RLS checks the parent goal's user_id.

create table if not exists public.savings_goal_line_items (
  id uuid not null default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,

  name text not null,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint savings_goal_line_items_pkey primary key (id)
);

create index if not exists idx_savings_goal_line_items_goal_id
  on public.savings_goal_line_items (goal_id);

alter table public.savings_goal_line_items enable row level security;

drop policy if exists "Users can view own goal line items" on public.savings_goal_line_items;
create policy "Users can view own goal line items"
  on public.savings_goal_line_items for select
  using (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  ));

drop policy if exists "Users can insert own goal line items" on public.savings_goal_line_items;
create policy "Users can insert own goal line items"
  on public.savings_goal_line_items for insert
  with check (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  ));

drop policy if exists "Users can update own goal line items" on public.savings_goal_line_items;
create policy "Users can update own goal line items"
  on public.savings_goal_line_items for update
  using (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  ));

drop policy if exists "Users can delete own goal line items" on public.savings_goal_line_items;
create policy "Users can delete own goal line items"
  on public.savings_goal_line_items for delete
  using (exists (
    select 1 from public.savings_goals g
    where g.id = goal_id and g.user_id = auth.uid()
  ));

drop trigger if exists savings_goal_line_items_set_updated_at on public.savings_goal_line_items;
create trigger savings_goal_line_items_set_updated_at
  before update on public.savings_goal_line_items
  for each row execute function public.handle_updated_at();

comment on table public.savings_goals is 'User savings goals (emergency fund + custom targets). Each goal is an abstract allocation against the user''s total liquid cash, not tied to a specific bank account.';
comment on column public.savings_goals.is_protected is 'Protected goals (emergency fund) cannot be demoted below unprotected goals in the priority waterfall.';
comment on column public.savings_goals.kind is 'emergency_fund | custom';
comment on column public.savings_goals.status is 'active | complete | archived';
comment on column public.savings_goals.priority is 'Lower = higher priority. Drives the cash allocation waterfall.';
comment on column public.savings_goals.ef_multiplier is 'For emergency_fund goals: months of runway the user picked.';
comment on column public.savings_goals.excluded_essential_category_ids is 'system_categories IDs the user excluded from the EF essentials auto-calc.';

comment on table public.savings_goal_line_items is 'Optional sub-budgets within a savings goal (e.g. trip: flights, hotel, food).';
