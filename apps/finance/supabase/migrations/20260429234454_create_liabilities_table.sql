-- Plaid Liabilities data — one row per liability account (credit card,
-- mortgage, student loan). Mirrors what the Plaid /liabilities/get
-- endpoint returns. The 80% common fields are real columns so dashboard
-- queries stay cheap; type-specific niche data (full APR list for credit,
-- PSLF status for student, escrow/PMI for mortgage) lives in `details`
-- JSONB.
--
-- For mortgages the regular installment is stored in
-- minimum_payment_amount (Plaid calls it next_monthly_payment) so the
-- "what's the minimum I owe this cycle" column is meaningful for all
-- three types.

create type public.liability_kind as enum ('credit', 'mortgage', 'student');

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.liability_kind not null,

  -- Payment info (common across types)
  last_payment_amount numeric,
  last_payment_date date,
  next_payment_due_date date,
  is_overdue boolean,
  minimum_payment_amount numeric,

  -- Statement balance (credit + student)
  last_statement_balance numeric,
  last_statement_issue_date date,

  -- Interest rate, normalized
  --   credit card: purchase APR (the most-used one; full list lives in details.aprs)
  --   mortgage:    interest_rate.percentage
  --   student:     interest_rate_percentage
  interest_rate numeric,
  interest_rate_type text,

  -- Loan-style fields (mortgage + student loans)
  origination_date date,
  origination_principal_amount numeric,
  expected_payoff_date date,            -- maturity_date for mortgage
  ytd_interest_paid numeric,
  ytd_principal_paid numeric,

  -- Type-specific extras (shape varies by `kind`):
  --   credit:    { aprs: [...] }
  --   mortgage:  { escrow_balance, has_pmi, has_prepayment_penalty,
  --                loan_term, loan_type_description, current_late_fee, past_due_amount }
  --   student:   { pslf_status, repayment_plan, loan_status,
  --                outstanding_interest_amount, loan_name, guarantor }
  details jsonb not null default '{}'::jsonb,

  synced_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (account_id)
);

create index liabilities_user_id_idx on public.liabilities (user_id);
create index liabilities_user_next_due_idx on public.liabilities (user_id, next_payment_due_date);

-- RLS: users can read/write only their own liabilities.
-- Service role (sync code) bypasses RLS as usual.
alter table public.liabilities enable row level security;

create policy "users can read own liabilities"
  on public.liabilities for select
  using (auth.uid() = user_id);

create policy "users can write own liabilities"
  on public.liabilities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists liabilities_set_updated_at on public.liabilities;
create trigger liabilities_set_updated_at
  before update on public.liabilities
  for each row execute function public.handle_updated_at();

comment on table  public.liabilities                       is 'Plaid /liabilities/get data, one row per liability account.';
comment on column public.liabilities.kind                  is 'Liability type: credit | mortgage | student.';
comment on column public.liabilities.minimum_payment_amount is 'Minimum payment due this cycle. For mortgages this stores Plaid''s next_monthly_payment.';
comment on column public.liabilities.interest_rate         is 'Normalized interest rate. For credit cards this is the purchase APR; full APR list lives in details.aprs.';
comment on column public.liabilities.expected_payoff_date  is 'Projected payoff date. For mortgages this stores Plaid''s maturity_date.';
comment on column public.liabilities.details               is 'Type-specific JSONB bag for fields that don''t merit a column.';
