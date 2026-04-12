# Finance Next

Personal finance platform with bank account integration, transaction tracking, budgeting, and investment portfolio monitoring.

## Tech Stack

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
src/
├── app/                    # Next.js App Router
│   ├── (main)/             # Protected routes (wrapped by AuthGuard + AppShell)
│   │   ├── dashboard/      # Financial overview
│   │   ├── accounts/       # Plaid-connected bank accounts
│   │   ├── transactions/   # Transaction history
│   │   ├── budgets/        # Budget tracking
│   │   ├── investments/    # Stock/crypto portfolio monitoring
│   │   └── settings/       # User preferences
│   └── api/                # API routes (see src/app/api/)
├── components/             # React components
│   ├── ui/                 # Reusable primitives (Button, Card, Modal, etc.)
│   ├── dashboard/          # Dashboard-specific cards
│   ├── UserProvider.jsx    # Global auth/theme context
│   ├── AppShell.tsx        # Layout wrapper with sidebar
│   └── AuthGuard.jsx       # Route protection
├── lib/                    # Utilities and services
│   ├── supabaseClient.js   # Client-side Supabase (with auth)
│   ├── supabaseAdmin.js    # Server-side admin client (bypasses RLS)
│   ├── marketData.js       # Finnhub ticker metadata helpers
│   ├── plaid/              # Plaid sync pipelines (transactions, holdings, etc.)
│   └── spending.js         # Budget calculations
├── config/                 # Configuration
│   └── dashboardLayout.js  # Dashboard card layout config
└── styles/
    └── colors.css          # CSS variables for light/dark themes
```

## Essential Commands

```bash
# Development
npm run dev              # Start Next.js dev server

# Build & Production
npm run build            # Build for production
npm run start            # Start production server

# Testing
npm run lint             # Run ESLint
npm test                 # Run Jest tests
npm test:watch           # Watch mode
npm test:coverage        # Generate coverage report
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key (server-side only)
- `FINNHUB_API_KEY` - Ticker metadata lookups (name, sector, domain)
- `STRIPE_SECRET_KEY` - Stripe API key (server-side only)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

## Key Entry Points

- Protected route layout: `src/app/(main)/layout.jsx:6`
- Auth state management: `src/components/UserProvider.jsx:22`
- Route protection: `src/components/AuthGuard.jsx:12`
- Supabase client setup: `src/lib/supabaseClient.js:11`
- Server-side DB access: `src/lib/supabaseAdmin.js:17`
- Dashboard layout config: `src/config/dashboardLayout.js:10`

## API Route Pattern

Routes follow Next.js App Router convention in `src/app/api/[feature]/route.js`:
- GET for fetching with query params
- POST for creating/processing
- DELETE for removal

Example: `src/app/api/budgets/route.js:4-56`

## Deployment

- **Main App**: Vercel (auto-deploy on push)

## Database Migrations

**CRITICAL:** When applying migrations via Supabase MCP (`apply_migration`), you **must also create a matching local migration file** in `supabase/migrations/`. The CI/CD pipeline runs `supabase db push` which compares the remote migration history table against local files — if a remote migration version has no local `.sql` file, the deploy **will fail**.

**Workflow:**
1. Apply migration via MCP `apply_migration` (this runs it on the remote DB and records the version)
2. Note the version timestamp from the MCP result (e.g. `20260411024907`)
3. Create `supabase/migrations/<version>_<name>.sql` with the same SQL content
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
| UI Style Guide | `docs/ui_style_guide.md` |
| Architecture & Patterns | `docs/architectural_patterns.md` |
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

## Slate UI (`@slate-ui/react`)

Custom component library maintained in a sibling repo at `../slate-ui` (GitHub: `Adarsh-S-Nair/slate-ui`).

- **Source**: `../slate-ui/src/components/` — TypeScript components built with Tailwind + CSS variables
- **Build**: `npm run build` in the slate-ui repo (uses `tsup`), outputs to `dist/`
- **Install in finance-next**: `npm install @slate-ui/react@github:Adarsh-S-Nair/slate-ui`
- **Tailwind scanning**: finance-next must include `@source "../../node_modules/@slate-ui/react/dist"` in `globals.css` so Tailwind 4 JIT generates utility classes used by slate-ui components
- **Theming**: Components consume CSS variables from `colors.css` (e.g. `--color-dropdown-bg`, `--color-fg`, `--color-surface`, `--color-accent`)
- **Components**: Dropdown, Button, Card, Tooltip, EmptyState, and more
- **Workflow**: Edit source in `../slate-ui/src/` → `npm run build` → commit + push slate-ui → `npm install` in finance-next to pull updated dist

## Working Conventions

- **TypeScript strict mode is enabled** — all new `.ts`/`.tsx` files must pass strict checks. When adding new provider hooks consumed by TypeScript files, add a `.d.ts` declaration file alongside the `.jsx` provider.
- **ESLint is configured** with `eslint-config-next`. React 19 strict rules (`set-state-in-effect`, `refs`, `purity`, `immutability`) are set to warn, not error. New code should avoid these patterns where possible.
- The codebase is mixed JS/TS (84% JS). Prefer TypeScript for new files, but don't convert existing JS files unless doing meaningful work in them.
- **Icon style**: Use chevrons (`‹ ›`) instead of arrows for directional indicators. Prefer plain text/numbers over pill-shaped badges.
