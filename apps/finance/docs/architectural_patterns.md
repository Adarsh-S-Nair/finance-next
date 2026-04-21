# Architectural Patterns

This document captures the patterns every new feature in this codebase should
follow. The goal is boring consistency — when you sit down to add a feature,
you shouldn't have to reinvent where things go.

---

## 1. Thin routes, fat lib

**Rule:** API routes are dispatchers. Business logic lives in `src/lib/<domain>/`.

A route handler does exactly four things:

1. Parse the request.
2. Resolve auth (via `requireVerifiedUserId`). **Never** read the user ID out
   of the request body — that's an IDOR waiting to happen. If a route needs
   to be callable from another route handler (e.g. `exchange-token` →
   `transactions/sync`), the caller must forward the verified `x-user-id`
   header on the inner request.
3. Dispatch to a lib function.
4. Format the HTTP response (success or error).

It does **not** talk to Plaid, Stripe, Supabase, or any external system
directly. It doesn't know about cursors, balances, or categories. If it
imports `supabaseAdmin`, that's a smell — it probably shouldn't.

### Reference implementation

`src/app/api/plaid/transactions/sync/route.js` → `src/lib/plaid/transactionSync/`

The route is ~40 lines. The pipeline lives in:

```
src/lib/plaid/transactionSync/
├── index.ts         # syncTransactionsForItem() — orchestrator (IO)
├── types.ts         # Types shared across the module
├── buildRows.ts     # PURE: Plaid tx → DB upsert row
├── categories.ts    # PURE: category planning + linking
└── __tests__/
    ├── buildRows.test.ts
    └── categories.test.ts
```

**Why this split:**

- **Pure functions (`buildRows`, `categories`)** take plain data in, return
  plain data out. No database, no network, no clock, no env vars. Unit-testable
  with a few literal inputs — no mocks, no fixtures, no setup.
- **Orchestrator (`index.ts`)** is where IO happens. It composes the pure
  functions, calls Supabase/Plaid, and handles error paths. Each IO step is
  its own small private function so the top-level orchestrator reads as a
  linear story.
- **Types (`types.ts`)** are narrow — they describe only the fields we read
  or write. We don't pull in the `plaid` package's generated types because
  they're broad and pull in unused surface area.

### What the route looks like

```js
export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const body = await request.json();
    if (!body.plaidItemId) return badRequest();

    const result = await syncTransactionsForItem({
      plaidItemId: body.plaidItemId,
      userId,
      forceSync: body.forceSync === true,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error?.httpStatus === 404) return notFound(error.message);
    return serverError('Failed to sync transactions', error?.message);
  }
}
```

That's it. The route can't hide bugs — there's nowhere for them to hide.

---

## 2. Prefer pure functions, quarantine IO

When you're writing a lib module, ask: "can this be a pure function?"

- Pure functions: **no awaits**, **no globals**, **no `new Date()` unless
  it's the input**, **no env vars**. If you need "now," pass it in.
- IO functions: small, single-purpose, async, named for what they do
  (`loadPlaidItem`, `markPlaidItemStatus`, `deletePendingReplacements`).

The orchestrator composes both. The test surface is the pure functions —
that's where the interesting decisions live, and that's where bugs hide.

**Do not write big "smart" IO functions that also contain branching logic.**
Extract the decision into a pure helper and test it.

---

## 3. Preserve behavior when refactoring

When pulling logic out of a monolithic route into a lib module, the goal is
structural — **do not silently fix bugs during the move**. If you find a
bug, mirror it with a `// NOTE:` or `// TODO:` comment explaining what's
wrong and fix it in a separate, reviewed change.

Concrete example from `transactionSync/categories.ts::computeBackfillPlan` —
the legacy route looks up category groups by their raw Plaid primary name
(`"FOOD_AND_DRINK"`) against rows stored by formatted name (`"Food and
Drink"`). The refactor preserves the bug verbatim and calls it out. Fix in
a separate PR with its own tests.

---

## 4. TypeScript for new files, .d.ts for JS dependencies

Per `CLAUDE.md`, all new files are TypeScript. For TS files that consume
existing JS modules, create an ambient `.d.ts` sidecar that declares the
narrow surface you use (see `src/lib/logger.d.ts`, `src/lib/plaid/client.d.ts`).

Rationale:

- Strict mode catches real bugs at the seam between TS and JS.
- Keeps `any` out of new code.
- Incrementally migrates the codebase without a big-bang rewrite.

Do **not** scatter `as any` casts. If the JS module's inferred type is
wrong, write a `.d.ts` — it's a few minutes of work and the whole codebase
benefits.

---

## 5. Logging discipline

New code uses `createLogger(context)` — not raw `console.log`. Log **events**,
not progress (`"Transactions upserted", { count: 42 }` ✓, `"About to upsert
transactions..."` ✗).

The existing monoliths have ~400 raw `console.log` calls. Don't add to the
pile. When you touch a file, clean up the logs you walk past. Eventually the
smoke clears.

---

## 6. Testing the new pattern

Every extracted lib module ships with unit tests for its pure functions.
Tests live next to the code in `__tests__/`:

```
src/lib/plaid/transactionSync/__tests__/buildRows.test.ts
src/lib/plaid/transactionSync/__tests__/categories.test.ts
```

Tests for pure functions should be **fast and literal**: construct an
input, call the function, assert on the output. No mocks, no fixtures, no
"setup" beyond a helper factory for the input type.

Integration/IO tests (if any) go in `src/__tests__/api/` where they live
today.

---

## Decision tree

When building a new feature, ask in order:

1. **Where does the business logic live?** → `src/lib/<domain>/`, not the route.
2. **What's pure vs. IO?** → Extract pure bits into their own files.
3. **Is this TypeScript?** → Yes. Always. (New files only.)
4. **Does it consume a JS module without types?** → Write a `.d.ts` sidecar.
5. **Can the pure parts be unit tested with literal inputs?** → They must be.
6. **Is the route handler still < 50 lines?** → If not, you skipped step 1.
