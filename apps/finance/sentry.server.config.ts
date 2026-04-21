/**
 * Sentry init for the Node.js runtime (API routes, server components, RSC).
 * Imported from instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 *
 * Runs only when NEXT_PUBLIC_SENTRY_DSN is set AND we're not in local
 * development — dev noise shouldn't hit Sentry quota.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isDev = process.env.NODE_ENV === 'development';

if (dsn && !isDev) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    debug: false,
  });
}
