-- Create recurring_transactions table
create table if not exists public.recurring_transactions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_name text not null,
  description text,
  amount numeric(12, 2) not null,
  frequency text not null check (frequency in ('weekly', 'bi-weekly', 'monthly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'ignored')),
  last_date date not null,
  next_date date not null,
  confidence numeric(3, 2) not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint recurring_transactions_pkey primary key (id)
);

-- Create indexes
create index if not exists idx_recurring_transactions_user_id 
  on public.recurring_transactions using btree (user_id);

create index if not exists idx_recurring_transactions_next_date 
  on public.recurring_transactions using btree (next_date);

-- Enable RLS
alter table public.recurring_transactions enable row level security;

-- RLS Policies
drop policy if exists "Users can view own recurring transactions" on public.recurring_transactions;
create policy "Users can view own recurring transactions"
  on public.recurring_transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own recurring transactions" on public.recurring_transactions;
create policy "Users can insert own recurring transactions"
  on public.recurring_transactions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own recurring transactions" on public.recurring_transactions;
create policy "Users can update own recurring transactions"
  on public.recurring_transactions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recurring transactions" on public.recurring_transactions;
create policy "Users can delete own recurring transactions"
  on public.recurring_transactions
  for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
drop trigger if exists recurring_transactions_set_updated_at on public.recurring_transactions;
create trigger recurring_transactions_set_updated_at
  before update on public.recurring_transactions
  for each row execute function public.handle_updated_at();

comment on table public.recurring_transactions is 'Detected recurring transactions/subscriptions';
