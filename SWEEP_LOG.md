# Sweep Log

Run history for the autonomous maintenance loop (`/sweep`, defined in
`.claude/commands/sweep.md`). Newest first. One line per run:

```
- YYYY-MM-DD HH:MM | <tier> | <action|finding|no-op|defer> | <signal → what was done> | <commit sha or —>
```

`finding` = diagnosed but intentionally not fixed (too big, or guardrailed) —
needs an owner decision. `defer` = skip this item in future runs.

## Runs

- 2026-06-13 01:50 | D | action | TS migration: NetWorthHoverContext.jsx → .tsx (typed hover payload + context value; consumers in NetWorthCard/AccountsSummaryCard unchanged); JS files remaining: 109 | see commit
- 2026-06-13 01:50 | A | no-op | Vercel prod (90m, spanning assistant-rail + toggle-smoothing deploys): zero error/warn entries | —

- 2026-06-13 00:30 | D | action | coverage: `resolveDirectionMismatches` (transactionSync/categories.ts refund/clawback re-routing) was the last untested pure function in the module → 6 tests covering Refund re-route, Other fallback, clear-when-no-target, and direction edge cases | see commit
- 2026-06-13 00:30 | A | no-op | Vercel prod (2h, spanning Bills-tab + Today deploys): zero error/warn entries | —

- 2026-06-12 23:20 | D | action | TS migration: ThemeProvider.jsx → .tsx (typed context value, ReactNode children); JS files remaining: 110 | see commit
- 2026-06-12 23:20 | A | no-op | Vercel prod (90m): clean — yesterday's lone POST/404 did not recur; advisors unchanged (findings already logged, awaiting owner) | —

- 2026-06-12 22:10 | D | action | coverage: goals money-math (`components/goals/types.ts` — allocateCash waterfall, rowToGoal, evaluatePace) was at 0% → added 14 unit tests, 437 total green | see commit
- 2026-06-12 22:10 | B | finding | Supabase performance advisors (guardrailed — DB changes): 102 RLS policies re-evaluate `auth.uid()` per row (auth_rls_initplan — fix is `(select auth.uid())` rewrite), 25 tables with multiple permissive policies, 30 unused indexes, 10 unindexed FKs, 1 duplicate index on `transactions` (`transactions_plaid_transaction_id_key` = `ux_transactions_plaid_id`) | —
- 2026-06-12 22:10 | A | no-op | Vercel prod (2h): one `POST / 404` warning (stale-client/bot shaped, single occurrence — watch, don't chase); Supabase clean | —

- 2026-06-12 21:00 | C | action | lint exhaustive-deps: `availableMonths` rebuilt every render in dashboard/page.jsx, re-running the default-month effect → wrapped in useMemo; warnings 4→2 (rest are tolerated React Compiler advisories in AgentChat) | see commit
- 2026-06-12 21:00 | B | finding | Supabase security advisors (guardrailed — DB changes need owner sign-off): (1) `find_user_by_email` is SECURITY DEFINER and executable by **anon** → user-enumeration risk, should revoke EXECUTE from anon; (2) same anon-executable issue on `bump_agent_usage_totals`, `cleanup_old_arbitrage_prices`, `prune_crypto_candles`, `upsert_category_rule`, `is_household_member`; (3) 6 functions have mutable search_path; (4) leaked-password protection disabled in Auth; (5) Postgres has pending security patches | —
- 2026-06-12 21:00 | A | no-op | Vercel prod runtime logs (24h): zero error/warn entries; Supabase postgres logs: routine only | —
