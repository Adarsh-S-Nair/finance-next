import { getAccounts } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);

    // Get user's accounts from database
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select(`
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
          item_id,
          access_token
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      return Response.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    return Response.json({ accounts });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error in accounts API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { accountId } = await request.json();

    if (!accountId) {
      return Response.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Delete account (verify ownership via user_id)
    const { error } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting account:', error);
      return Response.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error deleting account:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
