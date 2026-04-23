# Zervo

pnpm monorepo for [zervo.app](https://zervo.app) — a personal finance product (Plaid-connected accounts, transactions, budgets, investments) and a planned internal admin dashboard.

## Apps

- `apps/finance` — Next.js 16 app deployed at [zervo.app](https://zervo.app)
- `apps/admin` — internal admin dashboard at `admin.zervo.app` (planned)

Shared code lives in `packages/*` (e.g. `@zervo/ui` — the in-repo replacement for the old external `@slate-ui/react` package).

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript / JavaScript (mixed; see `CLAUDE.md` for migration posture)
- **Database**: Supabase (PostgreSQL with RLS)
- **Styling**: Tailwind CSS 4 + CSS variables for theming
- **Auth**: Supabase Auth (PKCE)
- **Charts**: Recharts
- **Animation**: Framer Motion
- **External APIs**: Plaid, CoinGecko, Yahoo Finance, Finnhub, Stripe
- **Testing**: Jest + React Testing Library

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 9.15+ (use Corepack: `corepack enable && corepack prepare pnpm@9.15.0 --activate`)

Do not mix in npm or yarn — only `pnpm-lock.yaml` is committed.

### Install

```bash
pnpm install
```

### Environment

Copy `apps/finance/.env.local.example` (or follow the variables documented in [`CLAUDE.md`](./CLAUDE.md#environment-variables)) into `apps/finance/.env.local`. The required keys cover Supabase, Plaid token encryption, Finnhub, Stripe, and the admin allowlist.

### Run

All scripts run from the workspace root.

```bash
pnpm dev              # Start finance dev server (http://localhost:3000)
pnpm dev:admin        # Start admin dev server   (http://localhost:3001)

pnpm build            # Build apps/finance
pnpm build:admin      # Build apps/admin
pnpm start            # Start finance prod server

pnpm lint             # ESLint across all packages
pnpm test             # Jest (apps/finance)
pnpm test:watch
pnpm test:coverage
```

Target a specific package directly with pnpm filters:

```bash
pnpm --filter @zervo/finance <script>
pnpm --filter @zervo/ui      <script>
```

## Deployment

Each app is its own Vercel project (root directory `apps/finance` or `apps/admin`). Pushes to `main` deploy automatically; conditional `ignore_command` rules in `infra/vercel.tf` skip the rebuild for projects whose paths weren't touched.

## More

- [`CLAUDE.md`](./CLAUDE.md) — full project conventions, env vars, and patterns
- [`apps/finance/docs/architectural_patterns.md`](./apps/finance/docs/architectural_patterns.md)
- [`apps/finance/docs/ui_style_guide.md`](./apps/finance/docs/ui_style_guide.md)
