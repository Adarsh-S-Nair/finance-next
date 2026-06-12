# Zervo Ideas Log

This file is the memory and fitness function for the product ideas loop
(`/ideate`, defined in `.claude/commands/ideate.md`). Each loop run picks one
evidence-anchored idea, builds a working demo, and records a pitch here. The
owner's verdicts — especially rejection reasons — are binding input for every
future run. Never re-propose a rejected idea or violate a taste constraint.

## Taste constraints

Distilled from verdicts. Hard rules for future pitches.

- Owner workflow: no PR review, no local verification. After a verdict of
  accept, ship to main and verify against the production deploy (this is a
  zero-customer project; prod is the test environment). Pitches still
  require a verdict before merging to main.

## Candidate backlog

Evidence-anchored ideas not yet pitched. Anchor types: **dormant** (data/code
exists, no UI), **friction** (observed errors/slowness), **parity** (competitor
staple Zervo lacks).

1. **Subscription manager** — dormant + parity. `recurring_streams` table has
   Plaid-detected streams (frequency, predicted_next_date, stream_type) but the
   only consumer is one agent tool. No "upcoming payments" or manage-subscriptions
   UI anywhere. This is Rocket Money's entire product.
2. **Portfolio sector/industry breakdown** — dormant. `stock_market_data` has
   sector, industry, market_cap, SMAs per ticker with ZERO references in the
   finance app. Holdings UI shows no allocation-by-sector view despite the data
   being synced.
3. **Loan payoff dashboard** — dormant. `liabilities` stores ytd_interest_paid,
   ytd_principal_paid, expected_payoff_date, interest_rate_type — none displayed.
   Payoff timeline + interest-paid view is a build, not a data project.
4. **Politician trades widget** — dormant. `apps/developer` hosts
   `/api/v1/trades` (congressional trade disclosures, currently mock data) with
   zero integration into the finance app. Could surface as a dashboard/agent
   widget, e.g. cross-referenced against the user's own holdings.
5. **Low-balance alerts** — dormant + parity. `account_snapshots` records daily
   balances but is only read by the net-worth chart. No threshold alerts.
   (Larger: needs a notification channel decision.)
6. **Household scoped views** — dormant. Three "coming soon" placeholder pages
   (`households/[id]/{budgets,transactions,investments}`); tables and switcher
   exist, aggregation logic doesn't. (Larger than one session — split if picked.)
7. **Pending vs posted transactions** — dormant. `authorized_date` vs `date`
   both stored, UI doesn't distinguish.
8. **Merchant enrichment** — dormant. `personal_finance_category`, `website`,
   `payment_channel`, `location` collected on transactions, barely/never shown
   or filterable.

## Dormant assets inventory

From codebase sweep 2026-06-12. Re-verify before building; update when things ship.

| Asset | UI coverage | Gap |
|-------|-------------|-----|
| `stock_market_data` table | 0% | sector/industry/SMA data never referenced in finance app |
| `recurring_streams` table | ~5% | agent tool only; no UI |
| `liabilities` table | ~20% | payoff/interest fields never displayed |
| `account_snapshots` table | ~30% | net-worth chart only; no alerts |
| `holdings.asset_type`, `tickers.sector` | ~50% | no allocation analytics |
| `transactions` enrichment fields | ~70% | PFC/location/website/payment_channel unused |
| household tables + switcher | ~5% | all scoped pages are placeholders |
| developer `/api/v1/trades` | 0% in finance app | fully orphaned (mock data) |
| Uncalled API routes | — | `transactions/category-history`, `transactions/monthly-overview`, `net-worth/current`, `market-data/historical-range`, `dashboard/summary`, `investments/by-date` |

## Competitor parity checklist

Features common in Monarch / Copilot / YNAB / Rocket Money that Zervo lacks.
Check off when shipped; strike through when rejected.

- [x] Subscription/recurring payment manager (shipped 2026-06-12, /recurring)
- [ ] Cash flow forecast (projected balance over next 30–90 days)
- [ ] Bill calendar / upcoming payments view
- [ ] Rule-based auto-categorization UI (agent can propose rules; no standalone manager)
- [ ] CSV import for accounts Plaid can't reach
- [ ] Sankey / flow diagram of monthly cash flow
- [ ] Net worth projection (forward-looking, not just history)
- [ ] Anomaly alerts (unusually large transaction, duplicate charge)
- [ ] Investment benchmark comparison (portfolio vs SPY)
- [ ] Savings goal auto-funding suggestions

## Verdicts

Newest first. Entry format:

```
### YYYY-MM-DD — Title
- Status: pending | accepted | accepted-with-changes | rejected | abandoned
- Branch: <branch>
- Pitch: <one paragraph, with evidence anchor>
- Gate caveat: <optional — anything the hard gate couldn't verify and why>
- Verdict reason: <owner's words, verbatim>
```

### 2026-06-12 — Subscription manager (/recurring page)
- Branch: claude/wizardly-knuth-wsx6tg (cloud session — idea branches unavailable)
- Pitch: A "Recurring" page surfacing the Plaid-detected `recurring_streams`
  data that until now only one agent tool could see (dormant asset, ~5% UI
  coverage; also competitor-parity item #1). Shows estimated monthly outflow
  as the hero number, subscriptions & bills sorted by predicted next charge
  ("Today" / "In 3 days" / "Due"), and recurring income below. Reuses the
  existing Pro-gated `/api/recurring/get` route unchanged — the entire build
  is UI plus pure display helpers with 14 unit tests. Nav item added under
  Finance with `tierFeature: "recurring"`.
- Gate caveat: typecheck/lint/test all pass; the screenshot step was
  impossible in this cloud session (no `SUPABASE_SERVICE_ROLE_KEY`, so API
  routes can't run). Verified post-deploy in production instead: /recurring
  serves 200 with the page mounted, /api/recurring/get returns 401 unauthed.
  Test user (test-power@zervo.test) was upgraded to pro and seeded with 7
  recurring_streams fixtures for hands-on testing.
- Status: accepted
- Verdict reason: "i don't want to look at it locally. for this project it
  is safe to just push it out to main and test it once the CI deploy
  finishes." (2026-06-12)
