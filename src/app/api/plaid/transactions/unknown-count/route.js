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

    // Count transactions where account name is unknown/null OR is_unmatched_transfer is true
    const { count: unknownAccountCount, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('accounts!inner(id)', { count: 'exact', head: true })
      .eq('accounts.user_id', userId)
      .or('accounts.name.is.null,is_unmatched_transfer.eq.true');

    console.log('Unknown transactions count query result:', { unknownAccountCount, countError, userId });

    if (countError) {
      console.error('Error counting unknown transactions:', countError);
      return Response.json({ count: 0 }); // Fail gracefully
    }

    return Response.json({ count: unknownAccountCount });

  } catch (error) {
    console.error('Error in unknown-count API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
