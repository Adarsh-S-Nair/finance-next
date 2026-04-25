-- Re-project `balances.current` for every account using the new
-- date-based projection semantics, so the UI doesn't have to wait for
-- the next sync to show correct numbers.
--
-- Mirrors the projection in lib/plaid/transactionSync/index.ts:
--
--   displayed = plaid_balance_current
--             + sign × ( Σ(amount of POSTED txs where date > as_of)
--                       + Σ(amount of currently-PENDING txs ingested
--                             within the last 14 days) )
--
-- where sign = -1 for credit/loan accounts (their balance is amount
-- owed; refunds reduce it, charges raise it) and +1 for everything
-- else.
--
-- Investment accounts are skipped — holdings sync owns their balance.

UPDATE public.accounts AS a
   SET balances = jsonb_set(
         COALESCE(a.balances, '{}'::jsonb),
         '{current}',
         to_jsonb(
           round(
             (
               a.plaid_balance_current
               + (CASE WHEN a.type IN ('credit', 'loan') THEN -1 ELSE 1 END)
                 * COALESCE(
                     (SELECT SUM(t.amount)
                        FROM public.transactions t
                       WHERE t.account_id = a.id
                         AND (
                           (
                             t.pending = false
                             AND a.plaid_balance_as_of IS NOT NULL
                             AND t.date > a.plaid_balance_as_of
                           )
                           OR (
                             t.pending = true
                             AND t.created_at > now() - INTERVAL '14 days'
                           )
                         )
                     ),
                     0
                   )
             )::numeric,
             2
           )
         ),
         true
       ),
       updated_at = now()
 WHERE a.plaid_balance_current IS NOT NULL
   AND a.type IS DISTINCT FROM 'investment';
