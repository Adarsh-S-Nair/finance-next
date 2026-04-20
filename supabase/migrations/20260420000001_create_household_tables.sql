-- Create household tables: households, household_members, household_invitations.
--
-- A household is a group of users (e.g. family, partners, roommates) who want
-- to share a combined view of their finances. This migration establishes the
-- primitive only — membership and invitations. Account-sharing and
-- net-worth aggregation land in a follow-up migration.

-- ---------------------------------------------------------------------------
-- Table: households
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.handle_updated_at();

create index if not exists idx_households_created_by
  on public.households using btree (created_by);

comment on table public.households is 'Group of users sharing a combined financial view.';
comment on column public.households.created_by is 'User who created the household (becomes initial owner).';

-- ---------------------------------------------------------------------------
-- Table: household_members
-- ---------------------------------------------------------------------------
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),

  primary key (household_id, user_id)
);

create index if not exists idx_household_members_user_id
  on public.household_members using btree (user_id);

comment on table public.household_members is 'Membership join table between users and households.';

-- ---------------------------------------------------------------------------
-- Table: household_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  used_at timestamptz null,
  used_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_household_invitations_code
  on public.household_invitations using btree (code);

create index if not exists idx_household_invitations_household_id
  on public.household_invitations using btree (household_id);

comment on table public.household_invitations is 'Join codes/links issued by household owners.';
comment on column public.household_invitations.code is 'Short case-insensitive code; stored uppercase.';

-- ---------------------------------------------------------------------------
-- Helper function to avoid recursive RLS on household_members
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: households
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;

drop policy if exists "Members can view household" on public.households;
create policy "Members can view household"
  on public.households
  for select
  using (public.is_household_member(id, auth.uid()));

drop policy if exists "Users can create household" on public.households;
create policy "Users can create household"
  on public.households
  for insert
  with check (auth.uid() = created_by);

drop policy if exists "Owners can update household" on public.households;
create policy "Owners can update household"
  on public.households
  for update
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

drop policy if exists "Owners can delete household" on public.households;
create policy "Owners can delete household"
  on public.households
  for delete
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: household_members
-- ---------------------------------------------------------------------------
alter table public.household_members enable row level security;

drop policy if exists "Members can view fellow members" on public.household_members;
create policy "Members can view fellow members"
  on public.household_members
  for select
  using (
    user_id = auth.uid()
    or public.is_household_member(household_id, auth.uid())
  );

-- Writes go through the service-role API; RLS for insert/update/delete is
-- deliberately omitted so direct client-side mutations are blocked.
drop policy if exists "Members can leave household" on public.household_members;
create policy "Members can leave household"
  on public.household_members
  for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: household_invitations
-- ---------------------------------------------------------------------------
alter table public.household_invitations enable row level security;

drop policy if exists "Members can view invitations" on public.household_invitations;
create policy "Members can view invitations"
  on public.household_invitations
  for select
  using (public.is_household_member(household_id, auth.uid()));
