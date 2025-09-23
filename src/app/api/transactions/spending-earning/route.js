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

    // Get all transactions for the user, grouped by month
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        datetime,
        accounts!inner (
          user_id
        )
      `)
      .eq('accounts.user_id', userId)
      .not('datetime', 'is', null)
      .order('datetime', { ascending: true });

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
      const date = new Date(transaction.datetime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          year: date.getFullYear(),
          monthNumber: date.getMonth() + 1,
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

    console.log('📊 Monthly Spending & Earning Array:', result);

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
