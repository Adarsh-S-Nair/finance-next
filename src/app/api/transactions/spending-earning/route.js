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

    // Fetch IDs of categories to ALWAYS exclude
    const alwaysExcludedCategories = [
      'Investment and Retirement Funds'
    ];

    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', alwaysExcludedCategories);

    const excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    // We need system_categories to identify "Transfer", "Credit Card Payment", etc.
    let query = supabaseAdmin
      .from('transactions')
      .select(`
        id,
        amount,
        date,
        accounts!inner (
          user_id
        ),
        system_categories (
          label
        )
      `)
      .eq('accounts.user_id', userId)
      .not('date', 'is', null)
      .gte('date', sinceDateStr)
      .order('date', { ascending: true });

    // Apply exclusion filter for "Investment and Retirement Funds"
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

    // Identify transfer categories
    const transferCategories = ['Credit Card Payment', 'Transfer', 'Account Transfer'];

    // Helper to check if a transaction is a transfer type
    const isTransfer = (tx) => {
      const label = tx.system_categories?.label;
      return label && transferCategories.includes(label);
    };

    // Set of matched transaction IDs to skip
    const matchedIds = new Set();

    // Group transactions by month and calculate spending/earning
    const monthlyData = {};

    // First pass: Identify matches for transfers
    // We iterate through all transactions. If it's a transfer and not matched yet, try to find a match.
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (matchedIds.has(tx.id)) continue;

      if (isTransfer(tx)) {
        // Look for a match
        // Match criteria:
        // 1. Different ID
        // 2. Not already matched
        // 3. Amount is opposite (tx.amount + match.amount === 0)
        // 4. Date within +/- 3 days

        const txDate = new Date(tx.date);
        const targetAmount = -parseFloat(tx.amount); // Look for opposite amount

        // We search in the whole array. 
        // Optimization: Since array is sorted by date, we can search locally around index i.
        // But for simplicity and correctness with small-ish N (thousands), linear scan or bounded scan is fine.
        // Let's do a bounded scan since it's sorted by date.

        let matchFound = false;

        // Scan forward
        for (let j = i + 1; j < transactions.length; j++) {
          const candidate = transactions[j];
          if (matchedIds.has(candidate.id)) continue;

          const candidateDate = new Date(candidate.date);
          const diffDays = (candidateDate - txDate) / (1000 * 60 * 60 * 24);

          if (diffDays > 3) break; // Too far in future, stop searching forward

          // Check amount match (using small epsilon for float comparison if needed, but usually exact for currency)
          if (Math.abs(parseFloat(candidate.amount) - targetAmount) < 0.01) {
            // Found a match!
            matchedIds.add(tx.id);
            matchedIds.add(candidate.id);
            matchFound = true;
            break;
          }
        }

        // If not found forward, we don't need to scan backward because if a match existed backward, 
        // it would have found *this* transaction when *that* transaction was processed (since we iterate i from 0).
        // So forward scan is sufficient.
      }
    }

    // Second pass: Aggregate data
    transactions.forEach(transaction => {
      // If it's a transfer and it WAS matched, we exclude it (it's an internal transfer).
      // If it's a transfer and it was NOT matched, we include it (Unmatched Transfer/Payment).
      // If it's NOT a transfer, we include it.

      if (matchedIds.has(transaction.id)) return;

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
