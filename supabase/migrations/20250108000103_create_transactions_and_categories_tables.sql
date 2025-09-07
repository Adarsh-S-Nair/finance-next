-- Create category_groups, system_categories, and transactions tables
-- These tables store transaction categorization and transaction data from Plaid

-- First create category_groups table (no dependencies)
create table if not exists public.category_groups (
  id uuid not null default gen_random_uuid(),
  name character varying(64) not null,
  icon_lib character varying(32) null,
  icon_name character varying(64) null,
  
  constraint category_groups_pkey primary key (id)
);

-- Create system_categories table (depends on category_groups)
create table if not exists public.system_categories (
  id uuid not null default gen_random_uuid(),
  label character varying(100) not null,
  description text null,
  hex_color character varying(7) not null default '#6B7280'::character varying,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  group_id uuid null,
  
  constraint system_categories_pkey primary key (id),
  constraint fk_category_group foreign key (group_id) 
    references category_groups (id) on delete set null,
  constraint system_categories_hex_color_check 
    check (hex_color ~ '^#[0-9A-Fa-f]{6}$'::text)
);

-- Create transactions table (depends on accounts and system_categories)
create table if not exists public.transactions (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null,
  plaid_transaction_id text null,
  description text not null,
  amount numeric(12, 2) not null,
  currency_code text null default 'USD'::text,
  pending boolean null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  merchant_name text null,
  icon_url text null,
  personal_finance_category jsonb null,
  category_id uuid null,
  datetime timestamptz null,
  location jsonb null,
  payment_channel text null,
  website text null,
  pending_plaid_transaction_id text null,
  
  constraint transactions_pkey primary key (id),
  constraint transactions_plaid_transaction_id_key unique (plaid_transaction_id),
  constraint fk_transactions_category_id foreign key (category_id) 
    references system_categories (id) on delete set null,
  constraint transactions_account_id_fkey foreign key (account_id) 
    references accounts (id) on delete cascade
);

-- Create indexes for category_groups
create index if not exists idx_category_groups_name 
  on public.category_groups using btree (name);

-- Create indexes for system_categories
create index if not exists idx_system_categories_label 
  on public.system_categories using btree (label);

create index if not exists idx_system_categories_group_id 
  on public.system_categories using btree (group_id);

create index if not exists idx_system_categories_hex_color 
  on public.system_categories using btree (hex_color);

-- Create indexes for transactions
create index if not exists idx_transactions_account_id 
  on public.transactions using btree (account_id);

create index if not exists idx_transactions_plaid_id 
  on public.transactions using btree (plaid_transaction_id);

create index if not exists idx_transactions_merchant_name 
  on public.transactions using btree (merchant_name);

create index if not exists idx_transactions_personal_finance_category 
  on public.transactions using gin (personal_finance_category);

create index if not exists idx_transactions_datetime 
  on public.transactions using btree (datetime desc);

create index if not exists idx_transactions_payment_channel 
  on public.transactions using btree (payment_channel);

create index if not exists idx_transactions_website 
  on public.transactions using btree (website);

create index if not exists idx_transactions_location 
  on public.transactions using gin (location);

create index if not exists idx_transactions_category_id 
  on public.transactions using btree (category_id);

create index if not exists idx_transactions_pending_plaid_id 
  on public.transactions using btree (pending_plaid_transaction_id);

create unique index if not exists ux_transactions_plaid_id 
  on public.transactions using btree (plaid_transaction_id);

-- Enable Row Level Security for all tables
alter table public.category_groups enable row level security;
alter table public.system_categories enable row level security;
alter table public.transactions enable row level security;

-- RLS Policies for category_groups (public read access, admin write access)
-- Allow everyone to read category groups (these are system-wide categories)
drop policy if exists "Anyone can view category groups" on public.category_groups;
create policy "Anyone can view category groups"
  on public.category_groups
  for select
  using (true);

-- Only authenticated users can insert category groups (for admin purposes)
drop policy if exists "Authenticated users can insert category groups" on public.category_groups;
create policy "Authenticated users can insert category groups"
  on public.category_groups
  for insert
  with check (auth.role() = 'authenticated');

-- Only authenticated users can update category groups
drop policy if exists "Authenticated users can update category groups" on public.category_groups;
create policy "Authenticated users can update category groups"
  on public.category_groups
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Only authenticated users can delete category groups
drop policy if exists "Authenticated users can delete category groups" on public.category_groups;
create policy "Authenticated users can delete category groups"
  on public.category_groups
  for delete
  using (auth.role() = 'authenticated');

-- RLS Policies for system_categories (public read access, admin write access)
-- Allow everyone to read system categories
drop policy if exists "Anyone can view system categories" on public.system_categories;
create policy "Anyone can view system categories"
  on public.system_categories
  for select
  using (true);

-- Only authenticated users can insert system categories
drop policy if exists "Authenticated users can insert system categories" on public.system_categories;
create policy "Authenticated users can insert system categories"
  on public.system_categories
  for insert
  with check (auth.role() = 'authenticated');

-- Only authenticated users can update system categories
drop policy if exists "Authenticated users can update system categories" on public.system_categories;
create policy "Authenticated users can update system categories"
  on public.system_categories
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Only authenticated users can delete system categories
drop policy if exists "Authenticated users can delete system categories" on public.system_categories;
create policy "Authenticated users can delete system categories"
  on public.system_categories
  for delete
  using (auth.role() = 'authenticated');

-- RLS Policies for transactions (user-specific access)
-- Users can only view transactions from their own accounts
drop policy if exists "Users can view own transactions" on public.transactions;
create policy "Users can view own transactions"
  on public.transactions
  for select
  using (
    exists (
      select 1 from public.accounts 
      where accounts.id = transactions.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Users can insert transactions for their own accounts
drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions
  for insert
  with check (
    exists (
      select 1 from public.accounts 
      where accounts.id = transactions.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Users can update transactions for their own accounts
drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions
  for update
  using (
    exists (
      select 1 from public.accounts 
      where accounts.id = transactions.account_id 
      and accounts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.accounts 
      where accounts.id = transactions.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Users can delete transactions for their own accounts
drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions
  for delete
  using (
    exists (
      select 1 from public.accounts 
      where accounts.id = transactions.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Add updated_at triggers
drop trigger if exists system_categories_set_updated_at on public.system_categories;
create trigger system_categories_set_updated_at
  before update on public.system_categories
  for each row execute function public.handle_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

-- Add comments for documentation
comment on table public.category_groups is 'Groups for organizing transaction categories';
comment on column public.category_groups.name is 'Display name of the category group';
comment on column public.category_groups.icon_lib is 'Icon library (e.g., lucide, heroicons)';
comment on column public.category_groups.icon_name is 'Icon name within the library';

comment on table public.system_categories is 'System-wide transaction categories for classification';
comment on column public.system_categories.label is 'Display label for the category';
comment on column public.system_categories.description is 'Optional description of the category';
comment on column public.system_categories.hex_color is 'Hex color code for UI display';
comment on column public.system_categories.group_id is 'Reference to category group';

comment on table public.transactions is 'User transaction data from Plaid API';
comment on column public.transactions.account_id is 'Reference to the account this transaction belongs to';
comment on column public.transactions.plaid_transaction_id is 'Unique identifier from Plaid API';
comment on column public.transactions.description is 'Transaction description';
comment on column public.transactions.amount is 'Transaction amount (positive for credits, negative for debits)';
comment on column public.transactions.currency_code is 'Currency code (default USD)';
comment on column public.transactions.pending is 'Whether transaction is pending';
comment on column public.transactions.merchant_name is 'Merchant name if available';
comment on column public.transactions.icon_url is 'Merchant icon URL';
comment on column public.transactions.personal_finance_category is 'Plaid personal finance category (JSON)';
comment on column public.transactions.category_id is 'User-assigned category';
comment on column public.transactions.datetime is 'Transaction datetime from Plaid';
comment on column public.transactions.location is 'Transaction location data (JSON)';
comment on column public.transactions.payment_channel is 'Payment channel (online, in_store, etc.)';
comment on column public.transactions.website is 'Merchant website';
comment on column public.transactions.pending_plaid_transaction_id is 'ID of pending transaction if this is a posted version';
