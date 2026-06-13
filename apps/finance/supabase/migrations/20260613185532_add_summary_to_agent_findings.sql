-- A short, human one-liner the detector authors to explain the finding
-- and its value in plain words (e.g. "Move it to high-yield savings to
-- earn about $623/yr"). The UI shows this instead of a bare dollar figure,
-- so the number is never ambiguous.
alter table public.agent_findings add column summary text;
