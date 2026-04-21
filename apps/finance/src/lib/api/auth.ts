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
 * This is the only supported way for HTTP route handlers to resolve the
 * caller's identity. Never read user IDs out of the request body — doing so
 * lets an authenticated user impersonate another user by passing a different
 * UUID (IDOR). If a route needs to be callable internally (e.g. from another
 * route handler), the caller must forward the verified x-user-id header.
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
