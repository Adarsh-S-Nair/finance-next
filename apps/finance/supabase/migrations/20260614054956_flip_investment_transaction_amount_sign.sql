-- Investment transactions were stored with Plaid's raw amount sign (positive
-- = cash debited for buys/fees, negative = cash credited for sells/dividends),
-- skipping the negation that regular transactions apply in
-- transactionSync/buildRows. This made sells/dividends display as money out
-- and buys as money in. Flip the sign of existing rows so they match the
-- app-wide convention (debits negative, credits positive). The sync code is
-- fixed going forward; this one-time backfill corrects historical rows.
update public.transactions
set amount = -amount
where transaction_source = 'investments';
