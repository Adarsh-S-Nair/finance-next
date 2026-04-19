/**
 * Sentry init for the browser. Next.js 15+ automatically imports this file
 * on the client once, before React hydrates.
 *
 * Runs only when NEXT_PUBLIC_SENTRY_DSN is set. Session Replay is disabled
 * for normal sessions but captures 100% of error sessions — cheap and very
 * useful for debugging UI crashes.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isDev = process.env.NODE_ENV === 'development';

if (dsn && !isDev) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    debug: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
