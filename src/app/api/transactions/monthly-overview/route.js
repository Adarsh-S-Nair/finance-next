import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get month and year from params or default to current
    const now = new Date();
    const month = parseInt(searchParams.get('month')) || now.getMonth(); // 0-indexed
    const year = parseInt(searchParams.get('year')) || now.getFullYear();

    // Calculate start and end of the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of the month

    // Format dates for Supabase query (YYYY-MM-DD)
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch transactions for the month
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select('amount, datetime, accounts!inner(user_id)')
      .eq('accounts.user_id', userId)
      .gte('datetime', startDateStr)
      .lte('datetime', endDateStr)
      .order('datetime', { ascending: true });

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Process data to calculate daily and cumulative totals
    const daysInMonth = endDate.getDate();

    let cumulativeIncome = 0;
    let cumulativeSpending = 0;

    // Initialize map for daily totals
    const dailyTotals = new Map();
    for (let i = 1; i <= daysInMonth; i++) {
      dailyTotals.set(i, { income: 0, spending: 0 });
    }

    // Aggregate transactions by day
    transactions.forEach(tx => {
      // Parse day from ISO datetime string (YYYY-MM-DDTHH:mm:ss)
      // We use the date part directly to avoid timezone shifts if the server is in a different zone than the data
      // Assuming the datetime is stored in UTC or consistent format
      const datePart = tx.datetime.split('T')[0];
      const dayPart = parseInt(datePart.split('-')[2]);

      if (dailyTotals.has(dayPart)) {
        const current = dailyTotals.get(dayPart);
        // User feedback: Positive amount is Income, Negative amount is Spending
        if (tx.amount > 0) {
          current.income += tx.amount;
        } else if (tx.amount < 0) {
          current.spending += Math.abs(tx.amount);
        }
      }
    });

    // Calculate cumulative totals
    const result = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dayData = dailyTotals.get(i);

      cumulativeIncome += dayData.income;
      cumulativeSpending += dayData.spending;

      // Create date string for the day
      // Construct date object safely
      const dateObj = new Date(year, month, i);
      const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      result.push({
        dateString: dateString,
        income: Math.round(cumulativeIncome),
        spending: Math.round(cumulativeSpending),
        dailyIncome: Math.round(dayData.income),
        dailySpending: Math.round(dayData.spending)
      });
    }

    return Response.json({ data: result });
  } catch (error) {
    console.error('Error in monthly overview API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
