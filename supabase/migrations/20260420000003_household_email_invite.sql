-- Look up a user by exact email for the household email-invite flow.
-- Returns at most one row. Exact (case-insensitive) match only — no fuzzy
-- matching or prefix search so we don't surface existence of accounts via
-- autocompletion. SECURITY DEFINER so the service-role server can call it;
-- execute is revoked from public and only granted to service_role.

create or replace function public.find_user_by_email(p_email text)
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return query
    select
      u.id,
      u.email::text,
      up.first_name,
      up.last_name,
      up.avatar_url
    from auth.users u
    left join public.user_profiles up on up.id = u.id
    where lower(u.email) = lower(trim(p_email))
    limit 1;
end $$;

revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to service_role;

comment on function public.find_user_by_email(text) is
  'Household email-invite lookup. Exact case-insensitive email match only.';
