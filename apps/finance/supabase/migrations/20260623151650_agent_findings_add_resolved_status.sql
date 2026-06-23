-- Allow findings to be auto-resolved when their detector no longer fires.
-- The sweep was write-only: it upserted detected findings but never cleared
-- ones whose situation had cleared, so a flag (e.g. idle cash after the cash
-- was moved) lingered indefinitely. Add a terminal 'resolved' status so the
-- runner can mark those; the resolved_at column already exists.
alter table public.agent_findings
  drop constraint agent_findings_status_check,
  add constraint agent_findings_status_check
    check (status in ('new', 'seen', 'acted', 'dismissed', 'resolved'));
