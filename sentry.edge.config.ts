/**
 * Sentry init for the Edge runtime (middleware, edge route handlers).
 * Imported from instrumentation.ts when NEXT_RUNTIME === 'edge'.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    debug: false,
  });
}
