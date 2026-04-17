/**
 * Sentry init for the Node.js runtime (API routes, server components, RSC).
 * Imported from instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 *
 * Runs only when NEXT_PUBLIC_SENTRY_DSN is set — absent DSN is a no-op so
 * local dev and pre-Sentry environments don't generate warnings.
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
