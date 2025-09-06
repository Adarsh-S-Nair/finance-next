-- Create table to store per-user profile settings/preferences
-- Includes profile image URL, UI theme, and accent color

create table if not exists public.user_profiles (
  -- Use auth.users.id as the primary key to enforce 1:1 with users
  id uuid primary key references auth.users(id) on delete cascade,

  -- Optional profile image URL
  avatar_url text,

  -- UI theme preference: 'light' | 'dark' | 'system'
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),

  -- Accent color in hex (e.g., #7c3aed). Allow null; validate format when provided
  accent_color text check (
    accent_color is null or accent_color ~* '^#(?:[0-9a-fA-F]{3}){1,2}$'
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on updates
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.handle_updated_at();

-- Enable Row Level Security and add policies for per-user access
alter table public.user_profiles enable row level security;

-- Users can view their own profile
drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

-- Users can insert their own profile row (id must match auth.uid())
drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = id);

-- Users can update their own profile
drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Helpful index for frequent lookups by id
create index if not exists user_profiles_id_idx on public.user_profiles (id);

comment on table public.user_profiles is 'Per-user profile settings: avatar_url, theme, and accent color.';
comment on column public.user_profiles.avatar_url is 'Publicly accessible image URL for the user''s avatar.';
comment on column public.user_profiles.theme is 'UI theme preference: light, dark, or system.';
comment on column public.user_profiles.accent_color is 'Preferred accent color in hex (e.g., #7c3aed).';

