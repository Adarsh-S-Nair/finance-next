-- Create contacts table
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

-- Enable RLS for contacts
alter table public.contacts enable row level security;

-- RLS Policies for contacts
create policy "Users can view their own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own contacts"
  on public.contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);


-- Create transaction_splits table
create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  is_settled boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS for transaction_splits
alter table public.transaction_splits enable row level security;

-- RLS Policies for transaction_splits
-- Users can access splits if they own the related transaction
create policy "Users can view their own transaction splits"
  on public.transaction_splits for select
  using (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_splits.transaction_id
      and a.user_id = auth.uid()
    )
  );

create policy "Users can insert their own transaction splits"
  on public.transaction_splits for insert
  with check (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_splits.transaction_id
      and a.user_id = auth.uid()
    )
  );

create policy "Users can update their own transaction splits"
  on public.transaction_splits for update
  using (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_splits.transaction_id
      and a.user_id = auth.uid()
    )
  );

create policy "Users can delete their own transaction splits"
  on public.transaction_splits for delete
  using (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_splits.transaction_id
      and a.user_id = auth.uid()
    )
  );


-- Create transaction_repayments table
create table if not exists public.transaction_repayments (
  id uuid primary key default gen_random_uuid(),
  repayment_transaction_id uuid references public.transactions(id) on delete cascade not null,
  split_id uuid references public.transaction_splits(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  created_at timestamptz default now()
);

-- Enable RLS for transaction_repayments
alter table public.transaction_repayments enable row level security;

-- RLS Policies for transaction_repayments
-- Users can access repayments if they own the repayment transaction
create policy "Users can view their own transaction repayments"
  on public.transaction_repayments for select
  using (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_repayments.repayment_transaction_id
      and a.user_id = auth.uid()
    )
  );

create policy "Users can insert their own transaction repayments"
  on public.transaction_repayments for insert
  with check (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_repayments.repayment_transaction_id
      and a.user_id = auth.uid()
    )
  );

create policy "Users can update their own transaction repayments"
  on public.transaction_repayments for update
  using (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_repayments.repayment_transaction_id
      and a.user_id = auth.uid()
    )
  );

create policy "Users can delete their own transaction repayments"
  on public.transaction_repayments for delete
  using (
    exists (
      select 1 from public.transactions t
      join public.accounts a on t.account_id = a.id
      where t.id = transaction_repayments.repayment_transaction_id
      and a.user_id = auth.uid()
    )
  );

-- Add comments
comment on table public.contacts is 'List of people the user transacts with for reimbursements';
comment on table public.transaction_splits is 'Portions of an expense transaction that are owed by a contact';
comment on table public.transaction_repayments is 'Allocations of a repayment transaction to settle a specific split';
