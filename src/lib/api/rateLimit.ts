import { NextResponse } from 'next/server';

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, WindowEntry>();

// Clean up stale entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const ROUTE_LIMITS: { prefix: string; config: RateLimitConfig }[] = [
  { prefix: '/api/cron/', config: { limit: 10, windowMs: 60_000 } },
  { prefix: '/api/', config: { limit: 60, windowMs: 60_000 } },
];

function getConfig(pathname: string): RateLimitConfig {
  for (const { prefix, config } of ROUTE_LIMITS) {
    if (pathname.startsWith(prefix)) return config;
  }
  return { limit: 60, windowMs: 60_000 };
}

/**
 * Check rate limit for a request. Returns a 429 NextResponse if the limit is
 * exceeded, or null if the request is allowed.
 */
export function checkRateLimit(
  key: string,
  pathname: string
): NextResponse | null {
  cleanup();

  const { limit, windowMs } = getConfig(pathname);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  return null;
}
