# Sweep Log

Run history for the autonomous maintenance loop (`/sweep`, defined in
`.claude/commands/sweep.md`). Newest first. One line per run:

```
- YYYY-MM-DD HH:MM | <tier> | <action|finding|no-op|defer> | <signal → what was done> | <commit sha or —>
```

`finding` = diagnosed but intentionally not fixed (too big, or guardrailed) —
needs an owner decision. `defer` = skip this item in future runs.

## Runs

(none yet)
