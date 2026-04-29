# Zervo Workspace

pnpm monorepo. Two apps share one codebase:

- `apps/finance` — the personal finance product (this file's historical "finance-next"). Deploys to Vercel at the primary domain.
- `apps/admin` — internal admin dashboard at `admin.zervo.app`. Same Supabase backend, gated by `ADMIN_EMAILS` allowlist.

Shared code lives in `packages/*`:
- `packages/ui` — shared component library (`@zervo/ui`), replaces the old external `@slate-ui/react` dep.
- `packages/supabase` — shared `Database` types + service-role admin client factory (`@zervo/supabase`).

Per-app code stays per-app: each app has its own browser/server Supabase clients (finance uses `@supabase/supabase-js` with custom PKCE + fetch patching; admin uses `@supabase/ssr` for cookie-based SSR). They share the Database type and the service-role client factory only.

## Tech Stack (apps/finance)

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript/JavaScript mixed codebase
- **Database**: Supabase (PostgreSQL with RLS)
- **Styling**: Tailwind CSS 4 + CSS variables for theming
- **Auth**: Supabase Auth with PKCE flow
- **Charts**: Recharts
- **Animation**: Framer Motion
- **External APIs**: Plaid (banking), CoinGecko (crypto prices), Yahoo Finance (stock prices), Finnhub (ticker metadata), Stripe (billing)
- **Linting**: ESLint with eslint-config-next
- **Testing**: Jest + React Testing Library

## Project Structure

```
/                           # workspace root (pnpm)
├── pnpm-workspace.yaml
├── package.json            # root manifest — thin, just dev scripts
├── apps/
│   ├── finance/            # personal finance Next.js app (zervo.app)
│   │   ├── src/
│   │   │   ├── app/                    # Next.js App Router
│   │   │   │   ├── (main)/             # Protected routes (wrapped by AuthGuard + AppShell)
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── accounts/
│   │   │   │   │   ├── transactions/
│   │   │   │   │   ├── budgets/
│   │   │   │   │   ├── investments/
│   │   │   │   │   └── settings/
│   │   │   │   └── api/                # API routes
│   │   │   ├── components/
│   │   │   │   ├── layout/             # AppShell, Sidebar, Topbar, ProfileBar, ...
│   │   │   │   ├── dashboard/
│   │   │   │   └── providers/
│   │   │   ├── lib/
│   │   │   │   ├── supabase/           # finance-specific browser/server clients
│   │   │   │   ├── plaid/
│   │   │   │   └── spending.js
│   │   │   └── styles/colors.css
│   │   ├── supabase/migrations/         # canonical migrations dir for the shared DB
│   │   └── ...
│   └── admin/              # internal admin Next.js app (admin.zervo.app)
│       ├── src/
│       │   ├── app/(admin)/            # protected admin routes
│       │   ├── components/             # AdminShell, AdminSidebar, AdminTopbar, ...
│       │   ├── lib/supabase/            # admin-specific @supabase/ssr clients
│       │   └── styles/colors.css
│       └── ...
└── packages/
    ├── ui/                 # @zervo/ui — shared UI primitives (Button, Card, ProfileBar, ...)
    └── supabase/           # @zervo/supabase — shared Database types + service-role admin client
```

## Essential Commands

All commands run from the workspace root.

```bash
# Development
pnpm dev                 # Start Next.js dev server (apps/finance)
pnpm dev:finance         # Same, explicit

# Build & Production
pnpm build               # Build apps/finance
pnpm start               # Start production server

# Testing
pnpm lint                # ESLint across all packages
pnpm test                # Jest (apps/finance)
pnpm test:watch
pnpm test:coverage

# Targeting a specific package directly
pnpm --filter @zervo/finance <script>
```

**Package manager:** pnpm (via Corepack — `corepack enable && corepack prepare pnpm@9.15.0 --activate`). Do not mix in npm/yarn — commit only `pnpm-lock.yaml`.

## Environment Variables

Required in `apps/finance/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key (server-side only)
- `FINNHUB_API_KEY` - Ticker metadata lookups (name, sector, domain)
- `STRIPE_SECRET_KEY` - Stripe API key (server-side only)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `PLAID_TOKEN_ENCRYPTION_KEY` - AES-256 key used to encrypt
  `plaid_items.access_token` / `accounts.access_token` at rest. 64 hex chars
  (preferred) or base64 that decodes to 32 bytes. Generate with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Rotating this key requires re-encrypting every stored token — treat loss
  as credential loss (all bank connections must be re-linked). To backfill
  existing plaintext tokens once: `node scripts/encrypt-plaid-tokens.mjs`
  from `apps/finance/`.
- `ADMIN_EMAILS` - Comma-separated allowlist of admin emails. Same value on
  apps/finance and apps/admin. Gates the admin subdomain and server-side
  `isCallerAdmin` checks on admin-only routes (e.g.
  `/api/tickers/refresh-crypto-logos`).

## Key Entry Points

All paths are relative to the workspace root.

- Protected route layout: `apps/finance/src/app/(main)/layout.jsx:6`
- Auth state management: `apps/finance/src/components/providers/UserProvider.jsx`
- Route protection: `apps/finance/src/components/AuthGuard.jsx`
- Supabase client setup: `apps/finance/src/lib/supabase/client.js`
- Server-side DB access: `apps/finance/src/lib/supabase/admin.js`
- Dashboard layout config: `apps/finance/src/config/dashboardLayout.js`

## API Route Pattern

Routes follow Next.js App Router convention in `apps/finance/src/app/api/[feature]/route.js`:
- GET for fetching with query params
- POST for creating/processing
- DELETE for removal

Example: `apps/finance/src/app/api/budgets/route.js`

## Deployment

- **apps/finance**: Vercel project `finance-next` — Root Directory `apps/finance`. Auto-deploy on push to `main`. Domain: `zervo.app`.
- **apps/admin**: Vercel project `finance-admin` — Root Directory `apps/admin`. Auto-deploy on push to `main`. Domain: `admin.zervo.app`. Same Supabase backend as finance, gated by `ADMIN_EMAILS` allowlist at middleware. Google OAuth via `supabase.auth.signInWithOAuth` (same Supabase Google provider as finance). Page port in dev: `3001` (`pnpm dev:admin`).

**Conditional deploys:** Each project has an `ignore_command` (see `infra/vercel.tf`) so pushes only rebuild the project whose paths changed. A commit that touches only `apps/admin` doesn't rebuild finance; `packages/**` and root pnpm files trigger both. Infra-only or docs-only changes skip both.

## Database Migrations

**CRITICAL:** When applying migrations via Supabase MCP (`apply_migration`), you **must also create a matching local migration file** in `apps/finance/supabase/migrations/`. The CI/CD pipeline runs `supabase db push` which compares the remote migration history table against local files — if a remote migration version has no local `.sql` file, the deploy **will fail**.

**Workflow** (every step required, no exceptions):
1. Apply the migration via MCP `apply_migration` (runs on remote DB, records the version).
2. Note the version timestamp from the MCP result (e.g. `20260411024907`).
3. Create `apps/finance/supabase/migrations/<version>_<name>.sql` with the same SQL content.
4. **Regenerate Database types** via MCP `generate_typescript_types` (project `ffydfwlnivdilemhzrta` = Production) and overwrite `packages/supabase/src/database.ts`. Skipping this means new columns are silently untyped in queries.
5. Run `pnpm typecheck` — if anything broke, this is where you find out (e.g. a column was renamed and existing code still references the old name).
6. Commit and push the migration file + regenerated types + any code fixes together.

**Never** apply a migration remotely without committing the matching local migration file AND regenerated types in the same push.

---

## Logging & Debugging

Logs are stored in Axiom. Query them from the Axiom web UI or CLI, not from
an in-app endpoint. (A public `/api/logs/query` endpoint previously existed
but was removed because any authenticated user could query every other
user's logs — it's a developer tool, not a product feature.)

### Logging Contexts

| Context | Description |
|---------|-------------|
| `plaid-webhook` | Plaid webhook handler |
| `plaid-webhook:transactions` | Transaction sync |
| `plaid-webhook:holdings` | Holdings sync |
| `plaid-webhook:item` | Item status changes |

### Using the Logger in Code

```javascript
import { createLogger, withLogging } from '@/lib/logger';

// Create a logger with context
const logger = createLogger('my-feature');
logger.info('Operation started', { userId: '123' });
logger.error('Operation failed', error, { context: 'data' });

// Time an operation
const opId = logger.startOperation('sync-data');
// ... do work ...
logger.endOperation(opId, { recordsProcessed: 50 });

// Wrap an API route for automatic logging
export const POST = withLogging('my-api', async (request, { logger }) => {
  logger.info('Processing request');
  return Response.json({ success: true });
});
```

---

## Additional Documentation

When working on specific areas, consult these files:

| Topic | File |
|-------|------|
| UI Style Guide | `apps/finance/docs/ui_style_guide.md` |
| Architecture & Patterns | `apps/finance/docs/architectural_patterns.md` |
| Log Debugging Guide | `.claude/docs/debugging_logs.md` |
| Agent test workflow (dev sign-in + seed) | `apps/finance/AGENTS.md` |

## Git & Commits

- Claude has full authority to **commit and push** to this project and related repos (e.g. slate-ui) without asking for confirmation each time.
- **Push directly to `main`** — do not create feature branches unless explicitly asked.
- **All commits must be authored AND committed as `Adarsh <asnair159@gmail.com>`**. Setting `--author` alone is NOT sufficient — the git `Committer` field defaults to Claude and must be overridden via environment variables. Use this pattern for every commit:
  ```bash
  GIT_COMMITTER_NAME="Adarsh" GIT_COMMITTER_EMAIL="asnair159@gmail.com" git commit --author="Adarsh <asnair159@gmail.com>" -m "..."
  ```
  Verify with `git log --format=full -1` — both `Author:` and `Commit:` must show Adarsh.
- **Do NOT include `Co-Authored-By` trailers** in commit messages. All commits should be attributed solely to the repo owner.
- **Do NOT include the Claude session URL** (e.g. `https://claude.ai/code/...`) in commit messages. It triggers co-author attribution.

## Shared packages

### `@zervo/ui`

Shared component library at `packages/ui`. **Replaces the old external `@slate-ui/react` package** — we stopped maintaining that separate repo once the monorepo landed (publish-loop friction was killing updates).

- **Source**: `packages/ui/src/` — TypeScript components built with Tailwind + CSS variables
- **Consumption**: both apps depend on it via `"@zervo/ui": "workspace:*"`. Edits propagate instantly — no publish, no reinstall.
- **Theming**: components consume CSS variables from `apps/*/src/styles/colors.css` (e.g. `--color-fg`, `--color-surface`, `--color-accent`).
- **Extraction discipline**: a component moves to `packages/ui` only after it's genuinely needed in both apps. Don't pre-extract churny components.

### `@zervo/supabase`

Shared Supabase glue at `packages/supabase`. Intentionally narrow:

- **`Database` type** — generated types for the shared Postgres schema. Both apps import this so query results are typed.
- **`createAdminClient<Database>()`** — service-role client factory for server-only admin operations. Identical config across apps (`autoRefreshToken: false`, `persistSession: false`).

**Not shared**: per-app browser/server Supabase clients. Finance uses `@supabase/supabase-js` directly with PKCE + custom `window.fetch` patching for `/api/*` calls; admin uses `@supabase/ssr` for cookie-based SSR. These genuinely differ — don't merge them.

## Working Conventions

- **TypeScript strict mode is enabled** — all new `.ts`/`.tsx` files must pass strict checks. When adding new provider hooks consumed by TypeScript files, add a `.d.ts` declaration file alongside the `.jsx` provider.
- **ESLint is configured** with `eslint-config-next`. The React Compiler advisory rule `react-hooks/set-state-in-effect` is `off` (it false-positives on legitimate mount-sync patterns from auth/portals/timers); `refs`/`purity`/`immutability` are `warn`. Both apps share the same rule overrides — keep them in sync if you change one.
- **CI runs typecheck + lint + test on every push/PR** (`.github/workflows/test.yml`). All three must pass before deploy.
- The codebase is mixed JS/TS (84% JS in finance). Prefer TypeScript for new files, but don't convert existing JS files unless doing meaningful work in them.
- **Icon style**: Use chevrons (`‹ ›`) instead of arrows for directional indicators. Prefer plain text/numbers over pill-shaped badges.
