# Finance Next

Personal finance platform with AI-powered investment strategy, bank account integration, and crypto arbitrage detection.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript/JavaScript mixed codebase
- **Database**: Supabase (PostgreSQL with RLS)
- **Styling**: Tailwind CSS 4 + CSS variables for theming
- **Auth**: Supabase Auth with PKCE flow
- **Charts**: Recharts, Nivo, Chart.js, Victory
- **Animation**: Framer Motion
- **External APIs**: Plaid (banking), CoinGecko (crypto), Yahoo Finance (stocks), Finnhub (market data)
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
│   │   ├── investments/    # Stock/crypto portfolios
│   │   ├── paper-trading/  # AI trading simulation
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
│   ├── marketData.js       # Stock/crypto data fetching
│   ├── spending.js         # Budget calculations
│   └── portfolioUtils.js   # Portfolio value calculations
├── config/                 # Configuration
│   └── dashboardLayout.js  # Dashboard card layout config
└── styles/
    └── colors.css          # CSS variables for light/dark themes

engine/                     # Standalone market data microservice
├── src/
│   ├── index.ts            # Main orchestrator
│   ├── feeds/coinbase.ts   # WebSocket client
│   └── storage/supabase.ts # Candle persistence
├── Dockerfile
└── fly.toml                # Fly.io deployment
```

## Essential Commands

```bash
# Development
npm run dev              # Start Next.js dev server

# Build & Production
npm run build            # Build for production
npm run start            # Start production server

# Testing
npm test                 # Run Jest tests
npm test:watch           # Watch mode
npm test:coverage        # Generate coverage report

# Data Scripts
npm run sync:nasdaq100   # Scrape NASDAQ-100 constituents
npm run populate:tickers # Fetch ticker details from Finnhub
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key (server-side only)
- `FINNHUB_API_KEY` - Market data API
- `GEMINI_API_KEY` - AI trading decisions (optional)

## Key Entry Points

- Protected route layout: `src/app/(main)/layout.jsx:6`
- Auth state management: `src/components/UserProvider.jsx:22`
- Route protection: `src/components/AuthGuard.jsx:12`
- Supabase client setup: `src/lib/supabaseClient.js:11`
- Server-side DB access: `src/lib/supabaseAdmin.js:17`
- Dashboard layout config: `src/config/dashboardLayout.js:10`
- Market data engine: `engine/src/index.ts:32`

## API Route Pattern

Routes follow Next.js App Router convention in `src/app/api/[feature]/route.js`:
- GET for fetching with query params
- POST for creating/processing
- DELETE for removal

Example: `src/app/api/budgets/route.js:4-56`

## Deployment

- **Main App**: Vercel (auto-deploy on push)
- **Market Data Engine**: Fly.io (Docker container in `engine/`)

---

## Logging & Debugging

Logs are stored in Axiom and can be queried via the `/api/logs/query` endpoint.

### Quick Log Queries

```bash
# Find errors in the last hour
GET /api/logs/query?level=error&hours=1

# Search for specific text
GET /api/logs/query?q=sync%20failed&hours=24

# Filter by context (e.g., plaid webhooks)
GET /api/logs/query?context=plaid-webhook&level=error&hours=24

# Trace a request by correlation ID
GET /api/logs/query?requestId=a1b2c3d4
```

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
| Architecture & Patterns | `.claude/docs/architectural_patterns.md` |
| Log Debugging Guide | `.claude/docs/debugging_logs.md` |
