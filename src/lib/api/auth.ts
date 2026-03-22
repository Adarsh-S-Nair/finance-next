import { NextRequest } from 'next/server';

/**
 * Reads the verified user ID injected by middleware.
 * Returns null if the header is missing (e.g., public routes or test contexts).
 */
export function getVerifiedUserId(request: NextRequest | Request): string | null {
  const headers = request.headers;
  return headers.get('x-user-id') || null;
}

/**
 * Reads the verified user ID injected by middleware.
 * Throws a 401 Response if the user ID is missing.
 *
 * Usage:
 *   const userId = requireVerifiedUserId(request);
 */
export function requireVerifiedUserId(request: NextRequest | Request): string {
  const userId = getVerifiedUserId(request);
  if (!userId) {
    throw Response.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }
  return userId;
}

/**
 * For routes that can be called both externally (via HTTP, middleware injects header)
 * and internally (via direct function import, no middleware, userId in body/options).
 *
 * Prefers the middleware-injected header, falls back to the provided bodyUserId.
 * Returns null if neither is available.
 */
export function resolveUserId(
  request: NextRequest | Request,
  bodyUserId?: string | null
): string | null {
  return getVerifiedUserId(request) || bodyUserId || null;
}
