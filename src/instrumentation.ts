/**
 * Server-side console → Axiom forwarder.
 *
 * Wraps console.log/info/warn/error so every server log (from any route,
 * lib, or dependency) also lands in Axiom. This is the backstop for routes
 * that don't use the createLogger/withLogging helpers yet.
 *
 * Fires only in the Node.js runtime (skips edge + browser). Uses direct
 * fetch with `keepalive: true` so the request survives even if a
 * serverless function returns immediately after.
 */

export async function register() {
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

  const ingest = (level: 'info' | 'warn' | 'error', args: unknown[]) => {
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
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    ingest('info', args);
  };
  console.info = (...args: unknown[]) => {
    origInfo(...args);
    ingest('info', args);
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    ingest('warn', args);
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    ingest('error', args);
  };

  origLog(
    `[instrumentation] console → Axiom forwarder active (dataset=${dataset})`,
  );
}
