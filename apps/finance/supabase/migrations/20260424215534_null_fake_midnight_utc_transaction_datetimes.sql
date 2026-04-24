-- Backfill: clear the fake midnight-UTC `datetime` values that the
-- transactionSync pipeline used to fabricate when Plaid omitted a real
-- `datetime`. Those rows ended up rendering as "12:00 AM" in the
-- transaction details drawer.
--
-- Going forward, the sync code stores `datetime = null` when Plaid
-- doesn't return a real time-of-day. This statement aligns existing
-- rows with that convention.
--
-- The condition matches *exactly* `<date>T00:00:00.000Z` so we don't
-- accidentally clobber any real Plaid datetime that genuinely landed
-- on midnight UTC on a different calendar day.

UPDATE public.transactions
   SET datetime = NULL
 WHERE datetime IS NOT NULL
   AND date IS NOT NULL
   AND datetime = (date::text || 'T00:00:00.000Z')::timestamptz;
