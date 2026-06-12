---
description: Run one iteration of the product ideas loop — pick a grounded idea, build a working demo, pitch it
---

You are running one iteration of the Zervo ideas loop. The goal is NOT to ship code —
it is to produce ONE pitch backed by a working demo, for the owner to accept or reject.
The owner's verdicts in `IDEAS.md` are the fitness function for this loop. Read them
first and treat them as binding constraints on what you propose.

## Procedure

1. **Read `IDEAS.md` in full.**
   - The "Taste constraints" section is hard rules — never propose something that violates them.
   - Scan past verdicts: never re-propose a rejected idea or a close variant of one,
     unless the rejection reason explicitly invited a different angle.
   - If any entry has `Status: pending`, STOP and ask the owner for a verdict on it
     instead of starting a new idea. One pitch in flight at a time.

2. **Source candidate ideas.** Ground every candidate in evidence, in this priority order:
   a. Real friction: errors or slow endpoints in Axiom logs, broken flows found while using the app.
   b. Dormant assets: DB tables/columns with no UI, API routes nothing calls, data the app
      collects but barely displays (see the "Dormant assets" section of IDEAS.md for the
      running inventory; update it if you find changes).
   c. Competitor parity: the checklist in IDEAS.md of features Monarch/Copilot/YNAB have
      that Zervo lacks. Drain it; check items off as they're built or rejected.
   Do not invent free-floating features with no anchor in (a), (b), or (c).

3. **Pick ONE idea.** Selection criteria, in order: strongest evidence anchor, smallest
   build (must fit one session), most aligned with past accepted verdicts.

4. **Build it on a branch** named `idea/<slug>`. Never on main. Keep the diff as small
   as a real demo allows — this is a pitch, not a production rollout. Follow the repo's
   conventions (CLAUDE.md, UI style guide).

5. **Hard gate before pitching** — all of these must pass, no exceptions:
   - `pnpm typecheck`, `pnpm lint`, `pnpm test`
   - A screenshot of the feature actually working in the running app (use the verify/run
     skill with the dev sign-in + seed flow in `apps/finance/AGENTS.md`).
   If you cannot get the demo working, do not pitch it. Record the attempt in IDEAS.md
   under verdicts with `Status: abandoned` and one line on what blocked it, then stop.

6. **Record the pitch** in IDEAS.md (newest first) using the entry format defined there,
   with `Status: pending`. Commit the IDEAS.md update and the demo branch; push both.

7. **Present the pitch** to the owner: one paragraph on what it is and why (cite the
   evidence anchor), the screenshot, the branch name. Then stop — do not merge, do not
   start another idea.

## After the owner gives a verdict (any later session)

- Update the entry: `Status: accepted | rejected | accepted-with-changes`, and record
  the owner's reason verbatim under `Verdict reason`.
- If a rejection reveals a general preference (not just "no to this one"), distill it
  into the "Taste constraints" section so future runs inherit it.
- Accepted ideas get merged/finished as normal work outside this loop.
