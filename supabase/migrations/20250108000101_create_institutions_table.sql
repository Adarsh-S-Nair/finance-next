-- Create institutions table to store Plaid institution data
-- This table stores information about financial institutions from Plaid

create table if not exists public.institutions (
  id uuid not null default gen_random_uuid(),
  institution_id text not null,
  name text not null,
  logo text null,
  primary_color text null,
  url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint institutions_pkey primary key (id),
  constraint institutions_institution_id_key unique (institution_id)
);

-- Create indexes for performance
create index if not exists idx_institutions_institution_id 
  on public.institutions using btree (institution_id);

-- Enable Row Level Security
alter table public.institutions enable row level security;

-- Institutions are publicly readable (needed for Plaid Link)
-- but only service role can insert/update/delete
drop policy if exists "Institutions are publicly readable" on public.institutions;
create policy "Institutions are publicly readable"
  on public.institutions
  for select
  using (true);

-- Only service role can modify institutions
drop policy if exists "Only service role can modify institutions" on public.institutions;
create policy "Only service role can modify institutions"
  on public.institutions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Add updated_at trigger
drop trigger if exists institutions_set_updated_at on public.institutions;
create trigger institutions_set_updated_at
  before update on public.institutions
  for each row execute function public.handle_updated_at();

-- Add comments for documentation
comment on table public.institutions is 'Financial institutions data from Plaid API';
comment on column public.institutions.institution_id is 'Plaid institution identifier';
comment on column public.institutions.name is 'Institution display name';
comment on column public.institutions.logo is 'Institution logo URL from Plaid';
comment on column public.institutions.primary_color is 'Institution primary brand color';
comment on column public.institutions.url is 'Institution website URL';
