-- One-time backfill: normalize every existing account name to Title Case.
-- Plaid surfaces account names in whatever casing the institution provides
-- ("CHASE SAVINGS", "Robinhood individual", etc.), which looks inconsistent
-- next to each other. Going forward the exchange-token handler applies
-- formatDisplayName() at write time; this backfills the historical rows
-- with Postgres's built-in initcap(), which does the same thing:
-- "convert first letter of each word to uppercase, rest to lowercase,
-- words split on non-alphanumeric characters."

update public.accounts
set name = initcap(name)
where name is not null
  and name <> initcap(name);
