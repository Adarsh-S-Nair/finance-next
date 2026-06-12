# Sweep Log

Run history for the autonomous maintenance loop (`/sweep`, defined in
`.claude/commands/sweep.md`). Newest first. One line per run:

```
- YYYY-MM-DD HH:MM | <tier> | <action|finding|no-op|defer> | <signal → what was done> | <commit sha or —>
```

`finding` = diagnosed but intentionally not fixed (too big, or guardrailed) —
needs an owner decision. `defer` = skip this item in future runs.

## Runs

- 2026-06-12 21:00 | C | action | lint exhaustive-deps: `availableMonths` rebuilt every render in dashboard/page.jsx, re-running the default-month effect → wrapped in useMemo; warnings 4→2 (rest are tolerated React Compiler advisories in AgentChat) | see commit
- 2026-06-12 21:00 | B | finding | Supabase security advisors (guardrailed — DB changes need owner sign-off): (1) `find_user_by_email` is SECURITY DEFINER and executable by **anon** → user-enumeration risk, should revoke EXECUTE from anon; (2) same anon-executable issue on `bump_agent_usage_totals`, `cleanup_old_arbitrage_prices`, `prune_crypto_candles`, `upsert_category_rule`, `is_household_member`; (3) 6 functions have mutable search_path; (4) leaked-password protection disabled in Auth; (5) Postgres has pending security patches | —
- 2026-06-12 21:00 | A | no-op | Vercel prod runtime logs (24h): zero error/warn entries; Supabase postgres logs: routine only | —
