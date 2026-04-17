/**
 * Server-side console → Axiom forwarder.
 *
 * Only forwards `console.warn` and `console.error` — info/log/debug stay
 * in Vercel runtime logs to avoid flooding Axiom with routine output
 * (price fetches, calculation traces, etc.). Important info-level events
 * (Plaid sync lifecycle, etc.) reach Axiom via createLogger/withLogging
 * on the routes that use them.
 *
 * Fires only in the Node.js runtime (skips edge + browser). Uses direct
 * fetch with `keepalive: true` so the request survives even if a
 * serverless function returns immediately after.
 */

export async function register() {
  // Sentry — server + edge runtimes. Gated internally by NEXT_PUBLIC_SENTRY_DSN.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }

  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const token = process.env.AXIOM_TOKEN;
  const dataset =
    process.env.NEXT_PUBLIC_AXIOM_DATASET || process.env.AXIOM_DATASET;
  if (!token || !dataset) return;

  const endpoint = `https://api.axiom.co/v1/datasets/${dataset}/ingest`;

  // Recursion guard: if our ingest fetch itself triggers a console call
  // (e.g. an undici warning), we must not re-enter.
  let inIngest = false;

  const formatArg = (a: unknown): string => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (typeof a === 'object' && a !== null) {
      try {
        return JSON.stringify(a);
      } catch {
        return '[unserializable]';
      }
    }
    return String(a);
  };

  const ingest = (level: 'warn' | 'error', args: unknown[]) => {
    if (inIngest) return;
    inIngest = true;
    try {
      const message = args.map(formatArg).join(' ');
      const errArg = args.find((a): a is Error => a instanceof Error);
      const event: Record<string, unknown> = {
        _time: new Date().toISOString(),
        level,
        message,
        source: 'server-console',
        runtime: 'nodejs',
      };
      if (errArg) {
        event.error = {
          name: errArg.name,
          message: errArg.message,
          stack: errArg.stack,
        };
      }
      if (process.env.VERCEL_DEPLOYMENT_ID) {
        event.deployment = process.env.VERCEL_DEPLOYMENT_ID;
      }
      if (process.env.VERCEL_ENV) {
        event.env = process.env.VERCEL_ENV;
      }

      fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([event]),
        keepalive: true,
      }).catch(() => {
        // Never let logging break the app.
      });
    } catch {
      // Never let logging break the app.
    } finally {
      inIngest = false;
    }
  };

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    ingest('warn', args);
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    ingest('error', args);
  };

  origLog(
    `[instrumentation] console.warn/error → Axiom forwarder active (dataset=${dataset})`,
  );
}

/**
 * Next.js 15+ hook — fires for errors during request handling (server
 * components, route handlers, etc.). Forwards to Sentry via the wrapper
 * from @sentry/nextjs, which is a no-op when Sentry.init hasn't run
 * (i.e. DSN unset).
 */
export { captureRequestError as onRequestError } from '@sentry/nextjs';
