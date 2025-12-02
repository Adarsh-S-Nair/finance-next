-- Create category_rules table to store user-defined categorization rules
-- This table stores rules that automatically categorize transactions based on conditions

create table if not exists public.category_rules (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  category_id uuid not null,
  conditions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint category_rules_pkey primary key (id),
  constraint category_rules_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade,
  constraint category_rules_category_id_fkey foreign key (category_id)
    references public.system_categories (id) on delete cascade
);

-- Create indexes for performance
create index if not exists idx_category_rules_user_id
  on public.category_rules using btree (user_id);

create index if not exists idx_category_rules_category_id
  on public.category_rules using btree (category_id);

-- Enable Row Level Security
alter table public.category_rules enable row level security;

-- Users can only access their own rules
drop policy if exists "Users can view own category rules" on public.category_rules;
create policy "Users can view own category rules"
  on public.category_rules
  for select
  using (auth.uid() = user_id);

-- Users can insert their own rules
drop policy if exists "Users can insert own category rules" on public.category_rules;
create policy "Users can insert own category rules"
  on public.category_rules
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own rules
drop policy if exists "Users can update own category rules" on public.category_rules;
create policy "Users can update own category rules"
  on public.category_rules
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own rules
drop policy if exists "Users can delete own category rules" on public.category_rules;
create policy "Users can delete own category rules"
  on public.category_rules
  for delete
  using (auth.uid() = user_id);

-- Add updated_at trigger
drop trigger if exists category_rules_set_updated_at on public.category_rules;
create trigger category_rules_set_updated_at
  before update on public.category_rules
  for each row execute function public.handle_updated_at();

-- Add comments for documentation
comment on table public.category_rules is 'User-defined rules for automatic transaction categorization';
comment on column public.category_rules.user_id is 'Owner of the rule';
comment on column public.category_rules.category_id is 'The category to apply when conditions are met';
comment on column public.category_rules.conditions is 'JSON array of conditions (e.g. [{field: "merchant_name", operator: "is", value: "Uber"}])';
