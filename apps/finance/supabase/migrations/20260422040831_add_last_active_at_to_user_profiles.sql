-- Track real "last active" time for the admin dashboard, separate from
-- auth.users.last_sign_in_at (which only updates on fresh sign-in, not on
-- silent token refresh, so it goes stale for users who stay logged in).

alter table public.user_profiles
  add column if not exists last_active_at timestamptz;

-- Backfill so existing rows aren't NULL. Use the more recent of the
-- profile's created_at and the auth user's last_sign_in_at — that's the
-- best lower bound for "last seen" without app-level data.
update public.user_profiles up
   set last_active_at = greatest(
         coalesce(au.last_sign_in_at, up.created_at),
         up.created_at
       )
  from auth.users au
 where up.id = au.id
   and up.last_active_at is null;

update public.user_profiles
   set last_active_at = created_at
 where last_active_at is null;
