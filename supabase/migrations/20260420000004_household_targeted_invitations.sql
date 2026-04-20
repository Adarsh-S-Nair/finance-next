-- Turn household_invitations into a dual-purpose table:
--   - Code-based invites: have a non-null `code`, anyone can redeem.
--   - Targeted invites: have a non-null `invited_user_id`, only that user
--     can accept (or decline). Surfaced in the invitee's notifications.
--
-- Changes:
--   1. `code` becomes nullable so targeted invites don't need one.
--   2. The unique index on `code` becomes a partial unique index so
--      null codes don't collide.
--   3. New `invited_user_id` points at the targeted recipient.
--   4. New `dismissed_at` records that the invitee declined.
--   5. Lookup index for the pending-invites query the invitee runs.

alter table public.household_invitations
  alter column code drop not null,
  add column if not exists invited_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists dismissed_at timestamptz;

drop index if exists idx_household_invitations_code;
create unique index if not exists idx_household_invitations_code
  on public.household_invitations (code)
  where code is not null;

create index if not exists idx_household_invitations_invitee_pending
  on public.household_invitations (invited_user_id)
  where invited_user_id is not null
    and used_at is null
    and dismissed_at is null
    and revoked_at is null;

-- An invite must be one of: code-based OR targeted at a user. Not neither.
alter table public.household_invitations
  drop constraint if exists household_invitations_code_or_target;
alter table public.household_invitations
  add constraint household_invitations_code_or_target
  check (code is not null or invited_user_id is not null);

-- The invitee should be able to read their own pending invites. Existing
-- RLS only lets household members read invitations — targeted invites to
-- a non-member would be invisible.
drop policy if exists "Invitees can view targeted invites" on public.household_invitations;
create policy "Invitees can view targeted invites"
  on public.household_invitations
  for select
  using (invited_user_id = auth.uid());

comment on column public.household_invitations.invited_user_id is
  'When set, the invite is targeted at this specific user instead of being redeemable by anyone with the code.';
comment on column public.household_invitations.dismissed_at is
  'Set when the targeted invitee declined the invite.';
