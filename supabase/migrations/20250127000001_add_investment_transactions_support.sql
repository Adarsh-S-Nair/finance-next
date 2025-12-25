-- Add support for investment transactions in the transactions table
-- This allows us to store both regular transactions and investment transactions in the same table

-- Add transaction_source column to distinguish transaction types
alter table public.transactions
  add column if not exists transaction_source text default 'transactions'
  check (transaction_source in ('transactions', 'investments'));

-- Add investment_details JSONB column to store investment-specific fields
-- This will store: security_id, quantity, price, subtype, fees, etc.
alter table public.transactions
  add column if not exists investment_details jsonb null;

-- Add index for transaction_source to enable efficient filtering
create index if not exists idx_transactions_transaction_source
  on public.transactions(transaction_source)
  where transaction_source = 'investments';

-- Add index for investment_details->security_id to enable efficient security lookups
create index if not exists idx_transactions_investment_security_id
  on public.transactions using gin ((investment_details->'security_id'))
  where transaction_source = 'investments';

-- Note: The existing unique constraint on plaid_transaction_id should work fine
-- since Plaid uses different ID formats for regular transactions vs investment transactions
-- (transaction_id vs investment_transaction_id), so they won't collide.
-- We'll keep the existing constraint as-is.

-- Create a regular index for plaid_transaction_id lookups if it doesn't exist
create index if not exists idx_transactions_plaid_id
  on public.transactions(plaid_transaction_id)
  where plaid_transaction_id is not null;

-- Add comment for documentation
comment on column public.transactions.transaction_source is 'Source of the transaction: transactions (regular) or investments (investment transactions)';
comment on column public.transactions.investment_details is 'Investment-specific transaction details (security_id, quantity, price, subtype, fees, etc.) stored as JSONB';

