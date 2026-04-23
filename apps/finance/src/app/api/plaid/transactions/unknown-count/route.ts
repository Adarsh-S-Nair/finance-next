import { supabaseAdmin } from '../../../../../lib/supabase/admin';
import { withAuth } from '../../../../../lib/api/withAuth';

export const GET = withAuth('unknown-count', async (_request, userId) => {
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

  console.log('Alerts count query result:', {
    unknownAccountCount,
    unmatchedTransferCount,
    totalCount,
    userId,
  });

  return Response.json({
    count: totalCount,
    unknownAccountCount: unknownAccountCount || 0,
    unmatchedTransferCount: unmatchedTransferCount || 0,
  });
});
