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
    // Use local time components to construct the string to match the 'date' column format
    const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // Fetch IDs of categories to ALWAYS exclude
    const alwaysExcludedCategories = [
      'Investment and Retirement Funds'
    ];

    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', alwaysExcludedCategories);

    const excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    // Fetch transactions for the month
    // We need system_categories to identify "Transfer", "Credit Card Payment", etc.
    let query = supabaseAdmin
      .from('transactions')
      .select('id, amount, date, accounts!inner(user_id), system_categories(label), transaction_splits(amount, is_settled)')
      .eq('accounts.user_id', userId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    // Apply exclusion filter for "Investment and Retirement Funds"
    if (excludedCategoryIds.length > 0) {
      query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
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

    // First pass: Identify matches for transfers
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (matchedIds.has(tx.id)) continue;

      if (isTransfer(tx)) {
        const txDate = new Date(tx.date);
        const targetAmount = -parseFloat(tx.amount); // Look for opposite amount

        // Scan forward
        for (let j = i + 1; j < transactions.length; j++) {
          const candidate = transactions[j];
          if (matchedIds.has(candidate.id)) continue;

          const candidateDate = new Date(candidate.date);
          const diffDays = (candidateDate - txDate) / (1000 * 60 * 60 * 24);

          if (diffDays > 3) break; // Too far in future, stop searching forward

          // Check amount match
          if (Math.abs(parseFloat(candidate.amount) - targetAmount) < 0.01) {
            // Found a match!
            matchedIds.add(tx.id);
            matchedIds.add(candidate.id);
            break;
          }
        }
      }
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
      // If it's a transfer and it WAS matched, we exclude it (it's an internal transfer).
      if (matchedIds.has(tx.id)) return;

      if (!tx.date) return;

      // Parse day from date string (YYYY-MM-DD)
      const dayPart = parseInt(tx.date.split('-')[2]);

      if (dailyTotals.has(dayPart)) {
        const current = dailyTotals.get(dayPart);
        const amount = parseFloat(tx.amount);

        // Calculate settled reimbursement amount
        const settledReimbursement = tx.transaction_splits?.reduce((sum, split) => {
          return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
        }, 0) || 0;

        // User feedback: Positive amount is Income, Negative amount is Spending
        if (amount > 0) {
          current.income += amount;
        } else if (amount < 0) {
          // Adjust usage: spending is absolute value of transaction amount minus settled reimbursements
          const adjustedSpending = Math.max(0, Math.abs(amount) - settledReimbursement);
          current.spending += adjustedSpending;
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
