import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Helper function to fetch and process transactions for a given month
async function getMonthData(userId, year, month, excludedCategoryIds) {
  // Calculate start and end of the month
  const endDate = new Date(year, month + 1, 0); // Last day of the month
  const daysInMonth = endDate.getDate();

  // Format dates for Supabase query (YYYY-MM-DD)
  const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  // Fetch transactions for the month
  let query = supabaseAdmin
    .from('transactions')
    .select('id, amount, date, accounts!inner(user_id), system_categories(label), transaction_splits(amount, is_settled), transaction_repayments(id)')
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
    return null;
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
      const targetAmount = -parseFloat(tx.amount);

      for (let j = i + 1; j < transactions.length; j++) {
        const candidate = transactions[j];
        if (matchedIds.has(candidate.id)) continue;

        const candidateDate = new Date(candidate.date);
        const diffDays = (candidateDate - txDate) / (1000 * 60 * 60 * 24);

        if (diffDays > 3) break;

        if (Math.abs(parseFloat(candidate.amount) - targetAmount) < 0.01) {
          matchedIds.add(tx.id);
          matchedIds.add(candidate.id);
          break;
        }
      }
    }
  }

  // Initialize map for daily totals
  const dailyTotals = new Map();
  for (let i = 1; i <= daysInMonth; i++) {
    dailyTotals.set(i, { income: 0, spending: 0 });
  }

  // Aggregate transactions by day
  transactions.forEach(tx => {
    if (matchedIds.has(tx.id)) return;
    if (tx.transaction_repayments && tx.transaction_repayments.length > 0) return;
    if (!tx.date) return;

    const dayPart = parseInt(tx.date.split('-')[2]);

    if (dailyTotals.has(dayPart)) {
      const current = dailyTotals.get(dayPart);
      const amount = parseFloat(tx.amount);

      const settledReimbursement = tx.transaction_splits?.reduce((sum, split) => {
        return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
      }, 0) || 0;

      if (amount > 0) {
        current.income += amount;
      } else if (amount < 0) {
        const adjustedSpending = Math.max(0, Math.abs(amount) - settledReimbursement);
        current.spending += adjustedSpending;
      }
    }
  });

  // Calculate cumulative totals
  let cumulativeIncome = 0;
  let cumulativeSpending = 0;
  const result = [];

  for (let i = 1; i <= daysInMonth; i++) {
    const dayData = dailyTotals.get(i);
    cumulativeIncome += dayData.income;
    cumulativeSpending += dayData.spending;

    const dateObj = new Date(year, month, i);
    const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    result.push({
      day: i,
      dateString: dateString,
      income: Math.round(cumulativeIncome),
      spending: Math.round(cumulativeSpending),
      dailyIncome: Math.round(dayData.income),
      dailySpending: Math.round(dayData.spending)
    });
  }

  return { daysInMonth, data: result };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get month and year from params or default to current
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const month = parseInt(searchParams.get('month')) || currentMonth; // 0-indexed
    const year = parseInt(searchParams.get('year')) || currentYear;

    // Check if the requested month is the current month
    const isCurrentMonth = (month === currentMonth && year === currentYear);

    // Calculate previous month
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }

    // Fetch IDs of categories to ALWAYS exclude
    const alwaysExcludedCategories = [
      'Investment and Retirement Funds'
    ];

    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', alwaysExcludedCategories);

    const excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    // Fetch current and previous month data in parallel
    const [currentMonthResult, prevMonthResult] = await Promise.all([
      getMonthData(userId, year, month, excludedCategoryIds),
      getMonthData(userId, prevYear, prevMonth, excludedCategoryIds)
    ]);

    if (!currentMonthResult) {
      return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    // Create previous month name for display
    const prevMonthName = new Date(prevYear, prevMonth, 1).toLocaleDateString('en-US', { month: 'long' });

    // Determine max days for x-axis (max of current month days and previous month days)
    const maxDays = Math.max(
      currentMonthResult.daysInMonth,
      prevMonthResult?.daysInMonth || 0
    );

    // Build merged data array with length = maxDays
    // Current month: only show spending up to currentDay if this is the current month
    // Previous month: show all data (complete month)
    const mergedData = [];
    for (let day = 1; day <= maxDays; day++) {
      const currentDayData = currentMonthResult.data.find(d => d.day === day);
      const prevDayData = prevMonthResult?.data.find(d => d.day === day);

      // For current month: only include spending data up to today's date
      // After today, spending should be null (line won't render for those points)
      let spending = null;
      let income = null;
      let dailySpending = null;
      let dailyIncome = null;

      if (currentDayData) {
        if (isCurrentMonth) {
          // Only show data up to and including today
          if (day <= currentDay) {
            spending = currentDayData.spending;
            income = currentDayData.income;
            dailySpending = currentDayData.dailySpending;
            dailyIncome = currentDayData.dailyIncome;
          }
        } else {
          // For past months, show all data
          spending = currentDayData.spending;
          income = currentDayData.income;
          dailySpending = currentDayData.dailySpending;
          dailyIncome = currentDayData.dailyIncome;
        }
      }

      // Generate date string for this day in the current/selected month
      const dateObj = new Date(year, month, day);
      const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      mergedData.push({
        day,
        dateString,
        spending,
        income,
        dailySpending,
        dailyIncome,
        previousSpending: prevDayData?.spending ?? null
      });
    }

    return Response.json({
      data: mergedData,
      previousMonthName: prevMonthName,
      previousMonthDays: prevMonthResult?.daysInMonth || 0,
      isCurrentMonth,
      currentDay: isCurrentMonth ? currentDay : null
    });
  } catch (error) {
    console.error('Error in monthly overview API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
