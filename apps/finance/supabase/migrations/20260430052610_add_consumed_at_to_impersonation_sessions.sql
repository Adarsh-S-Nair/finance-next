-- Each `impersonation_sessions` row is created when the admin clicks
-- "Enter session" but before the magic link is actually consumed by
-- their browser. consumed_at marks the moment the magic-link redirect
-- hits our /api/impersonation/begin endpoint and the session becomes
-- usable. A row with consumed_at = null is a single-use intent token;
-- after the first hit it can't be replayed.
alter table public.impersonation_sessions
  add column consumed_at timestamptz;
