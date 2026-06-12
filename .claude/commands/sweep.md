---
description: One iteration of the autonomous maintenance loop — find the highest-value verifiable issue and fix it
---

You are running one iteration of the Zervo maintenance sweep. Find ONE piece of
work backed by an objective signal, do it, verify it, ship it, log it. This loop
exists to convert real signals into small verified fixes — NOT to look busy.
"Nothing actionable" is a valid, logged outcome and is always better than
manufactured churn.

## Procedure

0. **Bootstrap if needed.** If `node_modules` is missing, run `pnpm install`
   from the workspace root before anything else.

1. **Read `SWEEP_LOG.md`** (repo root). Skip anything a recent run already did
   or deliberately skipped; respect items marked `defer`. If the previous run
   left something half-done, finish that instead of starting new work.

2. **Gather signals, in strict priority order.** Stop at the first tier that
   yields something actionable:

   **Tier A — production is misbehaving** (highest priority)
   - Vercel runtime logs for the finance project (last 24h): errors, repeated
     warnings, 5xx responses.
   - Supabase logs: API/Postgres errors.
   - If Axiom access is available, query recent error-level events.

   **Tier B — platform advisors**
   - Supabase `get_advisors` (security first, then performance). These come
     with concrete remediations and are pre-verified findings.

   **Tier C — repo health is broken or warning**
   - `pnpm typecheck`, `pnpm lint`, `pnpm test` — fix any failure or warning.

   **Tier D — structural debt** (only when A–C are clean)
   - Test coverage: add tests for the least-covered module that handles money
     math or sync (`lib/plaid/*`, `lib/spending.js`, budgets/goals API routes).
     Signal: coverage strictly increases.
   - TS migration: convert ONE JS file (prefer files imported by TS files).
     Signal: typecheck passes, no new `any`.
   Alternate between these across runs; check SWEEP_LOG.md for what last ran.

3. **Pick exactly ONE item.** Within a tier: highest user impact, then smallest
   fix. One item per run, no exceptions — the loop runs again later.

4. **Guardrails — never, without explicit owner sign-off:**
   - No database migrations or schema changes.
   - No deleting user-facing features or API routes (even "uncalled" ones —
     log them as findings instead).
   - No dependency major-version bumps.
   - No changes to auth, billing/Stripe, or encryption code paths — log a
     finding with your diagnosis instead.
   - Keep the diff small (roughly < 300 lines). If the proper fix is bigger,
     write up the diagnosis as a `finding` in SWEEP_LOG.md and stop.

5. **Hard gate before shipping:** `pnpm typecheck`, `pnpm lint`, `pnpm test`
   all pass. For behavior changes, add or extend a test that fails without the
   fix.

6. **Ship it.** Commit following the repo's authorship rules in CLAUDE.md.
   Push to `main` when running locally; in a cloud session, push to the
   session's designated branch.

7. **Log the run** — append (newest first) to `SWEEP_LOG.md`:
   ```
   - YYYY-MM-DD HH:MM | <tier> | <action|finding|no-op|defer> | <one line: signal → what was done> | <commit sha or —>
   ```
   Commit the log update with the fix. If the outcome was a `finding` the
   owner should see (production bug too big to fix here, security advisor
   needing a human call), also surface it in your reply; otherwise end quietly.
