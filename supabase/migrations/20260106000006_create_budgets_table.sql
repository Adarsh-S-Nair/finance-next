-- Create budgets table
create table if not exists public.budgets (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Flexible Scope: Can be a whole Group OR a specific detailed Category
  category_group_id uuid null references public.category_groups(id) on delete set null,
  category_id uuid null references public.system_categories(id) on delete set null,
  
  -- The budget amount
  amount numeric(12, 2) not null check (amount >= 0),
  
  -- Period (monthly, etc.)
  period text not null default 'monthly', -- detailed constraints could be added if needed
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraint: Must target EITHER a group OR a category, not both, not neither
  constraint budget_scope_check check (
    (category_group_id is not null and category_id is null) or
    (category_group_id is null and category_id is not null)
  ),
  
  -- Constraint: Unique budget per scope per user per period
  constraint unique_budget_per_scope unique (user_id, category_group_id, category_id, period),
  
  constraint budgets_pkey primary key (id)
);

-- Indexes
create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_budgets_category_group_id on public.budgets(category_group_id);
create index if not exists idx_budgets_category_id on public.budgets(category_id);

-- RLS
alter table public.budgets enable row level security;

-- Policies
create policy "Users can view own budgets"
  on public.budgets
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own budgets"
  on public.budgets
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budgets"
  on public.budgets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own budgets"
  on public.budgets
  for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.handle_updated_at();

-- Comments
comment on table public.budgets is 'User-defined spending limits for categories or groups';
comment on column public.budgets.amount is 'Budget limit amount';
comment on column public.budgets.period is 'Time period for the budget (e.g. monthly)';
