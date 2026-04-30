-- Enable Supabase Realtime on the two tables that drive the bell-icon
-- notification tray, so:
--   • a user's tray updates the moment an admin requests impersonation
--     access, or another household member invites them
--   • the admin's UserDrawer reflects approve/deny without a refresh
--
-- REPLICA IDENTITY FULL so UPDATE events ship every column. Without
-- this, an update to `status` on impersonation_grants wouldn't include
-- `target_user_id`/`requester_id` in the WAL row, and Realtime's
-- per-channel filter (`target_user_id=eq.<uid>`) would drop the event.
-- Both tables are low-volume — full replica identity is fine.

alter table public.impersonation_grants replica identity full;
alter table public.household_invitations replica identity full;

alter publication supabase_realtime add table public.impersonation_grants;
alter publication supabase_realtime add table public.household_invitations;
