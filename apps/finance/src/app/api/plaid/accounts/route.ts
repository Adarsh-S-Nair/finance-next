import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { resolveScope } from '../../../../lib/api/scope';

export const GET = withAuth('plaid/accounts:list', async (request, userId) => {
  const scope = await resolveScope(request, userId);
  if (scope instanceof Response) return scope;

  // Personal scope: just the caller. Household scope: every member of the
  // household. Per-account sharing opt-in is a follow-up — for now every
  // member account is visible household-wide.
  //
  // NOTE: the nested `plaid_items` select intentionally omits `access_token`.
  // This response is returned to the browser and leaking the token would let
  // anyone who opens DevTools read a user's bank credential. We also strip
  // `access_token` from the top-level `accounts` rows below (SELECT *
  // returns it because the column exists on the accounts table as well).
  const { data: accounts, error } = await supabaseAdmin
    .from('accounts')
    .select(
      `
      *,
      institutions (
        id,
        institution_id,
        name,
        logo,
        primary_color,
        url
      ),
      plaid_items (
        id,
        item_id
      )
    `
    )
    .in('user_id', scope.userIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching accounts:', error);
    return Response.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  // Defense in depth: even if a future change re-adds access_token to the
  // nested select, strip it here before the response leaves the server.
  const sanitized = (accounts ?? []).map((row) => {
    const rowAny = row as Record<string, unknown>;
    const { access_token: _stripAccessToken, plaid_items, ...rest } = rowAny;
    void _stripAccessToken;
    let cleanPlaidItems: unknown = plaid_items;
    if (plaid_items && typeof plaid_items === 'object') {
      const piAny = plaid_items as Record<string, unknown>;
      const { access_token: _stripNested, ...keep } = piAny;
      void _stripNested;
      cleanPlaidItems = keep;
    }
    return { ...rest, plaid_items: cleanPlaidItems };
  });

  return Response.json({ accounts: sanitized });
});

interface DeleteBody {
  accountId?: string;
}

export const DELETE = withAuth('plaid/accounts:delete', async (request, userId) => {
  const { accountId } = (await request.json()) as DeleteBody;

  if (!accountId) {
    return Response.json({ error: 'Account ID is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting account:', error);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  return Response.json({ success: true });
});
