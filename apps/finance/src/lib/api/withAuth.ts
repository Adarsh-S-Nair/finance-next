import { NextRequest } from 'next/server';
import { requireVerifiedUserId } from './auth';

/**
 * Next.js 16 always hands route handlers a context object (even for static
 * routes without dynamic segments — in that case `params` resolves to `{}`).
 * We widen the params shape to `Record<string, string>` so `withAuth` can
 * serve both static and dynamic routes without a generic at the call site.
 */
type RouteContext<TParams extends Record<string, string> = Record<string, string>> = {
  params: Promise<TParams>;
};

/**
 * Wraps a route handler with the standard auth + error-handling boilerplate.
 *
 * Resolves the verified user id, forwards the Next.js route context, and
 * converts uncaught throws into a 500 JSON response. If the handler throws
 * a Response (e.g. via `requireVerifiedUserId`), it is returned as-is.
 *
 * Usage — static route:
 *   export const GET = withAuth('budgets:list', async (request, userId) => {
 *     return Response.json({ data: await loadBudgets(userId) });
 *   });
 *
 * Usage — dynamic route:
 *   export const GET = withAuth<{ id: string }>(
 *     'households:get',
 *     async (request, userId, { params }) => {
 *       const { id } = await params;
 *       ...
 *     },
 *   );
 *
 * @param label Short identifier used in error logs (e.g. "budgets:list").
 */
export function withAuth<TParams extends Record<string, string> = Record<string, string>>(
  label: string,
  handler: (
    request: NextRequest,
    userId: string,
    context: RouteContext<TParams>,
  ) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    context: RouteContext<TParams>,
  ): Promise<Response> => {
    try {
      const userId = requireVerifiedUserId(request);
      return await handler(request, userId, context);
    } catch (err) {
      if (err instanceof Response) return err;
      console.error(`[${label}] unexpected error`, err);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}
