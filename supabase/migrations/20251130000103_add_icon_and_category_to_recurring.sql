-- Add icon_url and category_id to recurring_transactions table
alter table public.recurring_transactions
add column if not exists icon_url text,
add column if not exists category_id uuid references public.system_categories(id) on delete set null;

comment on column public.recurring_transactions.icon_url is 'URL of the merchant logo';
comment on column public.recurring_transactions.category_id is 'Foreign key to system_categories';
