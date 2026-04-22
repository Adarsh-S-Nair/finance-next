import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from './lib/api/rateLimit';

// Routes that do NOT require user auth.
//
// Only webhooks (authenticated by provider signature) and internal cron jobs
// (authenticated by CRON_SECRET inside the handler) belong here. Anything
// that uses the Supabase service-role client must go through user auth —
// otherwise anonymous callers can drive service-role DB access and/or burn
// through upstream API quotas.
//
// `/api/market-data/` used to be public, which meant anonymous callers could
// abuse our Yahoo/CoinGecko fan-out. Moved back behind auth 2026-04-22.
const PUBLIC_ROUTES = [
  '/api/plaid/webhook',
  '/api/stripe/webhook',
];

const PUBLIC_PREFIXES = [
  '/api/cron/',
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public routes still get per-IP rate limiting (except webhooks, which
  // have retry semantics and are authenticated by signature instead).
  // Without this, /api/market-data/* is an unauthenticated fan-out to
  // Yahoo/CoinGecko that anyone can blow through our quota with.
  if (isPublicRoute(pathname)) {
    const isWebhook = pathname.endsWith('/webhook');
    if (!isWebhook) {
      const ip = getClientIp(request);
      const rateLimited = checkRateLimit(`ip:${ip}`, pathname);
      if (rateLimited) return rateLimited;
    }
    return NextResponse.next();
  }

  // Protected routes: also rate limit by IP (skip webhooks)
  const isWebhook = pathname.endsWith('/webhook');
  if (!isWebhook) {
    const ip = getClientIp(request);
    const rateLimited = checkRateLimit(`ip:${ip}`, pathname);
    if (rateLimited) return rateLimited;
  }

  // Try to get the token from Authorization header first, then cookies
  let accessToken: string | null = null;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    accessToken = authHeader.slice(7).trim();
  }

  if (!accessToken) {
    // Extract from Supabase auth cookies
    // Supabase stores the session in cookies like sb-<project>-auth-token or sb-access-token
    for (const cookie of request.cookies.getAll()) {
      const { name, value } = cookie;
      if (name.includes('auth-token') || name === 'sb-access-token') {
        try {
          // The cookie value may be JSON (for the full session) or a plain token
          const parsed = JSON.parse(decodeURIComponent(value));
          if (Array.isArray(parsed) && parsed[0]) {
            // Supabase stores token as a chunked JSON array sometimes
            accessToken = typeof parsed[0] === 'string' ? parsed[0] : parsed[0]?.access_token;
          } else if (typeof parsed === 'object' && parsed?.access_token) {
            accessToken = parsed.access_token;
          } else if (typeof parsed === 'string') {
            accessToken = parsed;
          }
        } catch {
          // Plain string token
          accessToken = value;
        }
        if (accessToken) break;
      }
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify the token with Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // Fail closed on misconfiguration. We can't verify the token, so we must
    // not forward the request to downstream handlers (some of which trust
    // body-supplied userIds when x-user-id is absent).
    console.error(
      '[middleware] Supabase env vars missing — refusing to serve protected route',
      { pathname }
    );
    return NextResponse.json(
      { error: 'Service unavailable', message: 'Authentication service not configured' },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Per-user rate limit (more precise than IP-only)
    const userRateLimited = checkRateLimit(`user:${data.user.id}`, pathname);
    if (userRateLimited) return userRateLimited;

    // Inject verified userId into request headers for downstream route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', data.user.id);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Failed to verify session' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
