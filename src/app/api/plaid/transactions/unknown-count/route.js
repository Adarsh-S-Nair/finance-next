import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

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

    // 1. Count Unknown Accounts
    const { count: unknownAccountCount, error: unknownError } = await supabaseAdmin
      .from('transactions')
      .select('accounts!inner(id)', { count: 'exact', head: true })
      .eq('accounts.user_id', userId)
      .is('accounts.name', null);

    if (unknownError) {
      console.error('Error counting unknown accounts:', unknownError);
    }

    // 2. Count Unmatched Transfers
    const { count: unmatchedTransferCount, error: unmatchedError } = await supabaseAdmin
      .from('transactions')
      .select('accounts!inner(id)', { count: 'exact', head: true })
      .eq('accounts.user_id', userId)
      .eq('is_unmatched_transfer', true);

    if (unmatchedError) {
      console.error('Error counting unmatched transfers:', unmatchedError);
    }

    const totalCount = (unknownAccountCount || 0) + (unmatchedTransferCount || 0);

    console.log('Alerts count query result:', { unknownAccountCount, unmatchedTransferCount, totalCount, userId });

    if (unknownError || unmatchedError) {
      // Log but try to return what we have? Or just return 0?
      // Let's return what we have.
    }

    return Response.json({
      count: totalCount,
      unknownAccountCount: unknownAccountCount || 0,
      unmatchedTransferCount: unmatchedTransferCount || 0
    });

  } catch (error) {
    console.error('Error in unknown-count API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
