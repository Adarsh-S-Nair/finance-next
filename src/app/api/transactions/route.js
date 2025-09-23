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

    console.log('Fetching transactions from database for user:', userId);

    // Get user's transactions from database by joining through accounts
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        accounts!inner (
          id,
          name,
          mask,
          type,
          user_id,
          institutions (
            id,
            name,
            logo
          )
        ),
        system_categories (
          id,
          label,
          category_groups (
            id,
            name,
            icon_lib,
            icon_name,
            hex_color
          )
        )
      `)
      .eq('accounts.user_id', userId)
      .order('datetime', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000); // Limit to prevent large responses

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Transform the data to include account name and icon information for easier display
    const transformedTransactions = transactions.map(transaction => ({
      ...transaction,
      account_name: transaction.accounts?.name || 'Unknown Account',
      institution_name: transaction.accounts?.institutions?.name || 'Unknown Institution',
      category_icon_lib: transaction.system_categories?.category_groups?.icon_lib || null,
      category_icon_name: transaction.system_categories?.category_groups?.icon_name || null,
      category_hex_color: transaction.system_categories?.category_groups?.hex_color || null,
      category_name: transaction.system_categories?.label || null
    }));

    console.log(`Found ${transformedTransactions.length} transactions for user ${userId}`);

    return Response.json({ 
      transactions: transformedTransactions,
      count: transformedTransactions.length
    });
  } catch (error) {
    console.error('Error in transactions GET API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
