# Zervo Workspace

pnpm monorepo. Two apps share one codebase:

- `apps/finance` — the personal finance product (this file's historical "finance-next"). Deploys to Vercel at the primary domain.
- `apps/admin` — internal admin dashboard at `admin.zervo.app` (planned, not yet scaffolded).

Shared code will live in `packages/*` (UI primitives, Supabase client, config). `packages/ui` replaces the old external `@slate-ui/react` dep.

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
│   └── finance/            # Next.js app (everything from the old repo root lives here)
│       ├── src/
│       │   ├── app/                    # Next.js App Router
│       │   │   ├── (main)/             # Protected routes (wrapped by AuthGuard + AppShell)
│       │   │   │   ├── dashboard/
│       │   │   │   ├── accounts/
│       │   │   │   ├── transactions/
│       │   │   │   ├── budgets/
│       │   │   │   ├── investments/
│       │   │   │   └── settings/
│       │   │   └── api/                # API routes
│       │   ├── components/
│       │   │   ├── ui/                 # Reusable primitives (will migrate to packages/ui)
│       │   │   ├── dashboard/
│       │   │   └── providers/
│       │   ├── lib/
│       │   │   ├── supabaseClient.js
│       │   │   ├── supabaseAdmin.js
│       │   │   ├── marketData.js
│       │   │   ├── plaid/
│       │   │   └── spending.js
│       │   ├── config/
│       │   │   └── dashboardLayout.js
│       │   └── styles/
│       │       └── colors.css
│       ├── supabase/migrations/
│       ├── public/
│       ├── next.config.mjs
│       ├── tsconfig.json
│       └── vercel.json
└── packages/               # (planned) shared code
    ├── ui/                 # UI primitives (Button, Card, Modal, ...)
    ├── supabase/           # shared client + generated types
    └── config/             # shared tsconfig / eslint / tailwind preset
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

## Key Entry Points

All paths are relative to the workspace root.

- Protected route layout: `apps/finance/src/app/(main)/layout.jsx:6`
- Auth state management: `apps/finance/src/components/providers/UserProvider.jsx`
- Route protection: `apps/finance/src/components/AuthGuard.jsx`
- Supabase client setup: `apps/finance/src/lib/supabaseClient.js`
- Server-side DB access: `apps/finance/src/lib/supabaseAdmin.js`
- Dashboard layout config: `apps/finance/src/config/dashboardLayout.js`

## API Route Pattern

Routes follow Next.js App Router convention in `apps/finance/src/app/api/[feature]/route.js`:
- GET for fetching with query params
- POST for creating/processing
- DELETE for removal

Example: `apps/finance/src/app/api/budgets/route.js`

## Deployment

- **apps/finance**: Vercel project — Root Directory set to `apps/finance`. Auto-deploy on push to `main`.
- **apps/admin** (planned): separate Vercel project at `admin.zervo.app` — Root Directory `apps/admin`. Same Supabase backend, gated by `ADMIN_EMAILS` allowlist.

## Database Migrations

**CRITICAL:** When applying migrations via Supabase MCP (`apply_migration`), you **must also create a matching local migration file** in `apps/finance/supabase/migrations/`. The CI/CD pipeline runs `supabase db push` which compares the remote migration history table against local files — if a remote migration version has no local `.sql` file, the deploy **will fail**.

**Workflow:**
1. Apply migration via MCP `apply_migration` (this runs it on the remote DB and records the version)
2. Note the version timestamp from the MCP result (e.g. `20260411024907`)
3. Create `apps/finance/supabase/migrations/<version>_<name>.sql` with the same SQL content
4. Commit and push the migration file along with your code changes

**Never** apply a migration remotely without committing the corresponding local file in the same push.

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

## Shared UI (`@zervo/ui` — planned)

Shared component library lives in `packages/ui` inside this workspace. **This replaces the old external `@slate-ui/react` package** — we stopped maintaining that separate repo once the monorepo landed (publish-loop friction was killing updates).

- **Source**: `packages/ui/src/` — TypeScript components built with Tailwind + CSS variables
- **Consumption**: `apps/finance` and `apps/admin` depend on `@zervo/ui` via pnpm workspace (`"@zervo/ui": "workspace:*"`). Edits propagate instantly — no publish, no reinstall.
- **Theming**: Components consume CSS variables from `apps/*/src/styles/colors.css` (e.g. `--color-fg`, `--color-surface`, `--color-accent`).
- **Extraction discipline**: a component moves to `packages/ui` only after it's genuinely needed in both apps. Don't pre-extract churny components.

## Working Conventions

- **TypeScript strict mode is enabled** — all new `.ts`/`.tsx` files must pass strict checks. When adding new provider hooks consumed by TypeScript files, add a `.d.ts` declaration file alongside the `.jsx` provider.
- **ESLint is configured** with `eslint-config-next`. React 19 strict rules (`set-state-in-effect`, `refs`, `purity`, `immutability`) are set to warn, not error. New code should avoid these patterns where possible.
- The codebase is mixed JS/TS (84% JS). Prefer TypeScript for new files, but don't convert existing JS files unless doing meaningful work in them.
- **Icon style**: Use chevrons (`‹ ›`) instead of arrows for directional indicators. Prefer plain text/numbers over pill-shaped badges.
