# Agent Testing Guide

This file documents how AI agents (Claude Code, etc.) sign into the finance
app to test changes, take screenshots, or verify UI work that lives behind
`AuthGuard`.

## TL;DR

```bash
pnpm seed:power     # one-time: seed test-power@zervo.test with mock data
pnpm dev            # start the dev server (apps/finance)
# open http://localhost:3000/auth, use the "[dev only]" form below the
# Google button, click "Sign in (dev)"
```

Credentials are hard-coded into the dev sign-in form:

| Email                     | Password         | Notes                           |
|---------------------------|------------------|---------------------------------|
| `test-power@zervo.test`   | `TestPower123!`  | 3 Chase accounts, ~150 txs      |
| `test-ftux@zervo.test`    | `TestFTUX123!`   | empty user, exercises FTUX flow |

## How it works

- **Seed scripts** (`scripts/seed/`) call Supabase admin API to create the
  user with email/password, then insert mock institutions, accounts, and
  transactions. Inline fixtures — no external mock-data files.
- **Dev sign-in form** lives on `src/app/auth/page.jsx`, hard-gated to
  `process.env.NODE_ENV !== 'production'`. The form is hidden in prod
  builds — verified by `next build && grep` if you're paranoid.
- **Plaid is not called** for these users. The stored `access_token` values
  are placeholder strings; `decryptPlaidToken` passes plaintext through
  for legacy compat, so reads work, but any code that actually hits Plaid
  with these tokens will get an error from Plaid (not from us).

## Re-running

`createTestUser` deletes the user if it already exists, then recreates.
Safe to run `pnpm seed:power` repeatedly — you'll get a fresh dataset
each time. The transaction generator is seeded (deterministic), so the
data shape is stable across runs.

## Caveats

- The seeded user lives on the **production Supabase project** (we only
  have one). The user is identifiable by the `@zervo.test` email domain.
  Don't be surprised if it shows up in admin tools.
- Email/password sign-in is enabled at the Supabase level. The dev-only
  form is the only UI path; production users can't reach it because the
  form doesn't render under `NODE_ENV=production`.
- Don't commit changes that ungate the form. If you find yourself wanting
  the form in prod, you're solving the wrong problem.

## Adding scenarios

To seed a new persona (e.g., "investor with stocks"):

1. Add a new `scripts/seed/seed-<persona>.js` modeled on `seed-power-user.js`.
2. Use the helpers in `seed-utils.js` — `createTestUser`, `upsertInstitution`,
   `insertPlaidItem`, `insertAccounts`, `insertTransactions`.
3. Add a `seed:<persona>` entry to `apps/finance/package.json` scripts.
4. Update the credentials table above.

Keep fixtures inline in the script — don't reintroduce a `mock-data/`
directory unless multiple seed scripts need to share data.
