-- Add a random accent color to households so each one renders with its own
-- visual identity in the rail and on the household dashboard.
--
-- Existing rows get a color picked uniformly from the curated palette in
-- src/lib/households/server.ts; new rows are assigned by the API on insert.

alter table public.households
  add column if not exists color text not null default '#6366f1' check (
    color ~* '^#(?:[0-9a-fA-F]{3}){1,2}$'
  );

-- Backfill existing households with a deterministic-but-varied color based
-- on their id, so they don't all show up as indigo.
do $$
declare
  palette text[] := array[
    '#e11d48', '#f97316', '#f59e0b', '#65a30d',
    '#16a34a', '#0d9488', '#0284c7', '#6366f1',
    '#8b5cf6', '#d946ef', '#db2777'
  ];
begin
  update public.households
  set color = palette[1 + (abs(hashtext(id::text)) % array_length(palette, 1))]
  where color = '#6366f1';
end $$;

comment on column public.households.color is 'Hex color used to identify the household visually (rail bubble, header).';
