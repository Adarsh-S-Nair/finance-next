import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);

    // Get all transactions to extract unique months (only from 'transactions' source)
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select('date, accounts!inner(user_id)')
      .eq('accounts.user_id', userId)
      .eq('transaction_source', 'transactions')
      .not('date', 'is', null)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching transactions for available months:', error);
      return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return Response.json({ months: [] });
    }

    // Get unique months from transactions
    const monthsSet = new Set();
    transactions.forEach(transaction => {
      if (!transaction.date) return;

      // Parse date (YYYY-MM-DD)
      const [yearStr, monthStr] = transaction.date.split('-');
      const monthKey = `${yearStr}-${monthStr}`;
      monthsSet.add(monthKey);
    });

    // Convert to array and sort (newest first)
    const months = Array.from(monthsSet)
      .sort()
      .reverse()
      .map(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          value: monthKey,
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        };
      });

    return Response.json({ months });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error in available-months API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
