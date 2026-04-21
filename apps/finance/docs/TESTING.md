# Testing Guide — Zervo (finance-next)

This document explains how to set up and use the local QA/test environment for Zervo. The test environment uses a **mock Plaid provider** and a **separate Supabase project** so you can test the full app without hitting real APIs or using real bank accounts.

---

## Quick Start

```bash
# 1. Copy the test env template
cp .env.test.example .env.test

# 2. Fill in your TEST Supabase credentials (see "Test Supabase Project" below)
#    Leave all Plaid values as-is (they're already configured for mock mode)

# 3. Start the app in test mode
npm run dev:test

# 4. Optionally seed a test user
npm run seed:ftux       # Empty user (FTUX flow)
npm run seed:power      # Power user with accounts + transactions
npm run seed:investor   # Investment-heavy user
```

---

## Architecture

### Mock Plaid Provider

When `PLAID_ENV=mock` is set, all Plaid API calls are intercepted by the mock client at `src/lib/plaid/mock-client.js`. No real Plaid API calls are made.

The mock client:
- Returns realistic fake data matching Plaid's actual response shapes
- Simulates all Plaid methods: `createLinkToken`, `exchangePublicToken`, `accountsGet`, `transactionsSync`, `investmentsHoldingsGet`, `investmentsTransactionsGet`, `institutionsGetById`, `itemRemove`
- Is deterministic — the same inputs produce the same outputs
- **Never runs in `NODE_ENV=production`** — there's a hard guard that throws an error if both `PLAID_ENV=mock` and `NODE_ENV=production` are set

### Client Routing

`src/lib/plaidClient.js` selects the correct implementation based on `PLAID_ENV`:

```
PLAID_ENV=mock         → src/lib/plaid/mock-client.js
PLAID_ENV=sandbox      → src/lib/plaid/client.js (real Plaid SDK)
PLAID_ENV=development  → src/lib/plaid/client.js (real Plaid SDK)
PLAID_ENV=production   → src/lib/plaid/client.js (real Plaid SDK)
```

### Mock Fixture Data

Fixture data lives in `src/lib/plaid/mock-data/`:

| File | Contents |
|------|----------|
| `institutions.js` | Chase, BofA, Schwab, Wells Fargo |
| `accounts.js` | Checking, savings, credit card, brokerage, IRA |
| `transactions.js` | ~20 merchant templates; `generateTransactions()` creates deterministic sets |
| `investments.js` | Holdings and investment transactions for AAPL, MSFT, VOO, VTI, NVDA, GOOGL |

---

## Test Supabase Project

The test environment uses a **completely separate Supabase project**. Never use your production project for testing.

### Setup Steps

1. Go to [supabase.com](https://supabase.com) → New Project → Create a project named `zervo-test`
2. Once created, copy your project credentials from **Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Apply migrations to the test project. You can do this via the Supabase SQL editor (paste each file in `supabase/migrations/` in order) or with the Supabase CLI:
   ```bash
   supabase db push --db-url "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
   ```
4. Update `.env.test` with these values

---

## Running the App in Test Mode

```bash
npm run dev:test
```

This starts Next.js with `.env.test` loaded (via `dotenv-cli` or similar). The app will:
- Connect to your test Supabase project
- Use mock Plaid (no real bank connections)
- Print `[finance-next] Using MOCK Plaid client (PLAID_ENV=mock)` in the console

---

## Seed Scripts

Seed scripts create reproducible test users in your test Supabase project. They use the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

> ⚠️ Run seed scripts against your **test** Supabase project only. They delete existing users with the same email before recreating them.

### `npm run seed:ftux`

Creates a user with **no connected accounts** for testing the FTUX (first-time user experience) flow.

```
Email:    test-ftux@zervo.test
Password: TestFTUX123!
```

Use this to test:
- Onboarding screen
- "Connect your bank" empty state
- Plaid Link mock flow (clicking connect will use mock data)

### `npm run seed:power`

Creates a power user with **4 accounts across 2 banks** and ~240 transactions.

```
Email:    test-power@zervo.test
Password: TestPower123!

Accounts:
  Chase Total Checking  (...4242)  $4,821
  Chase Savings         (...7891)  $18,340
  Chase Sapphire Preferred (...3337) $1,800 balance / $10,000 limit
  BofA Savings          (...2211)  $9,234
```

Use this to test:
- Account list with multiple banks
- Transaction history and filtering
- Category breakdowns
- Spending summaries

### `npm run seed:investor`

Creates an investment-focused user with **brokerage and IRA accounts** at Charles Schwab.

```
Email:    test-investor@zervo.test
Password: TestInvest123!

Accounts:
  Schwab Investor Checking (...4400)   $12,450
  Schwab Brokerage         (...5511)   $87,432  → AAPL, MSFT, VOO, NVDA
  Schwab Roth IRA          (...9902)   $43,211  → VTI, GOOGL
```

Use this to test:
- Portfolio / holdings view
- Investment performance charts
- Mixed account types (checking + investment)

---

## Acceptance Checklist

Before marking a test run complete, verify:

- [ ] `npm run dev:test` starts with no errors
- [ ] Console shows `Using MOCK Plaid client (PLAID_ENV=mock)`
- [ ] Can sign up with a new account
- [ ] Clicking "Connect bank" opens the mock Plaid Link flow
- [ ] After connecting, fake accounts appear in the dashboard
- [ ] Transactions load and show realistic merchant names + categories
- [ ] FTUX seed user sees the onboarding flow on first login
- [ ] Power user seed shows accounts from 2 banks
- [ ] Investor seed shows portfolio holdings in the investments view
- [ ] No real Plaid API calls appear in network panel

---

## File Reference

```
.env.test.example              # Template — copy to .env.test
src/lib/plaidClient.js         # Entry point — routes to real or mock client
src/lib/plaid/client.js        # Real Plaid SDK wrapper
src/lib/plaid/mock-client.js   # Mock Plaid client (PLAID_ENV=mock only)
src/lib/plaid/mock-data/
  accounts.js                  # Fake account fixtures
  institutions.js              # Fake institution fixtures
  transactions.js              # Fake transaction generator
  investments.js               # Fake holdings + investment transactions
scripts/seed/
  seed-utils.js                # Shared utilities (Supabase admin client, helpers)
  seed-empty-user.js           # FTUX user (no accounts)
  seed-power-user.js           # Power user (4 accounts, ~240 txs)
  seed-investment-user.js      # Investment user (brokerage + IRA)
```

---

## Troubleshooting

**"Missing required Plaid environment variables"**
Make sure `.env.test` has `PLAID_CLIENT_ID` and `PLAID_SECRET` set (they can be any non-empty strings in mock mode).

**"PLAID_ENV=mock is not allowed in NODE_ENV=production"**
This is intentional. Mock mode is blocked in production for safety.

**Seed script fails with "relation does not exist"**
Your test Supabase project is missing migrations. Apply all files in `supabase/migrations/` in order.

**Seed script fails with auth error**
Check that `SUPABASE_SERVICE_ROLE_KEY` in `.env.test` is the **service role** key (not the anon key) from your test Supabase project.
