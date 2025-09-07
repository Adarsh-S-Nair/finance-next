import { getAccounts } from '../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's accounts from database
    const { data: accounts, error } = await supabase
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
    console.error('Error in accounts API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { accountId, userId } = await request.json();

    if (!accountId || !userId) {
      return Response.json(
        { error: 'Account ID and user ID are required' },
        { status: 400 }
      );
    }

    // Delete account (RLS will ensure user can only delete their own accounts)
    const { error } = await supabase
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
    console.error('Error deleting account:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
