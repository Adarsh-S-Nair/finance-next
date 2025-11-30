import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const monthsParam = parseInt(searchParams.get('months') || '24', 10);
    const MAX_MONTHS = Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 36) : 24;

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get all transactions for the user, grouped by month
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - MAX_MONTHS);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    // Fetch IDs of excluded categories
    const excludedCategories = [
      'Credit Card Payment',
      'Investment and Retirement Funds',
      'Transfer',
      'Account Transfer'
    ];

    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', excludedCategories);

    const excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        amount,
        date,
        accounts!inner (
          user_id
        )
      `)
      .eq('accounts.user_id', userId)
      .not('date', 'is', null)
      .gte('date', sinceDateStr)
      .order('date', { ascending: true });

    // Apply exclusion filter if we have IDs
    if (excludedCategoryIds.length > 0) {
      query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Group transactions by month and calculate spending/earning
    const monthlyData = {};

    transactions.forEach(transaction => {
      if (!transaction.date) return;

      // Parse date (YYYY-MM-DD)
      const [yearStr, monthStr] = transaction.date.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const monthKey = `${yearStr}-${monthStr}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          year: year,
          monthNumber: month,
          spending: 0,
          earning: 0,
          netAmount: 0,
          transactionCount: 0
        };
      }

      const amount = parseFloat(transaction.amount);
      monthlyData[monthKey].transactionCount++;

      if (amount < 0) {
        // Negative amount = spending (debit)
        monthlyData[monthKey].spending += Math.abs(amount);
      } else if (amount > 0) {
        // Positive amount = earning (credit)
        monthlyData[monthKey].earning += amount;
      }

      monthlyData[monthKey].netAmount += amount;
    });

    // Convert to array and sort by month
    const monthlyArray = Object.values(monthlyData).sort((a, b) => {
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      return a.monthNumber - b.monthNumber;
    });

    // Add month names for better readability
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const result = monthlyArray.map(month => ({
      ...month,
      monthName: monthNames[month.monthNumber - 1],
      formattedMonth: `${monthNames[month.monthNumber - 1]} ${month.year}`
    }));

    if (DEBUG) console.log(`📊 Monthly Spending & Earning: months=${result.length} (cap=${MAX_MONTHS})`);

    return Response.json({
      data: result,
      summary: {
        totalMonths: result.length,
        totalSpending: result.reduce((sum, month) => sum + month.spending, 0),
        totalEarning: result.reduce((sum, month) => sum + month.earning, 0),
        totalTransactions: result.reduce((sum, month) => sum + month.transactionCount, 0)
      }
    });
  } catch (error) {
    console.error('Error in spending-earning API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
