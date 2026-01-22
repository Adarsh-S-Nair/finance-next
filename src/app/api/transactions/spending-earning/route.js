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

    // Determine the user's earliest transaction date to exclude incomplete months
    const { data: earliestTxResult } = await supabaseAdmin
      .from('transactions')
      .select('date, accounts!inner(user_id)')
      .eq('accounts.user_id', userId)
      .order('date', { ascending: true })
      .limit(1);

    const earliestTransactionDate = earliestTxResult?.[0]?.date
      ? new Date(earliestTxResult[0].date)
      : null;

    // Calculate the start of the first complete month
    // If earliest transaction is after the 1st, skip that month entirely
    let firstCompleteMonthStart = null;
    if (earliestTransactionDate) {
      if (earliestTransactionDate.getDate() > 1) {
        // Skip to next month
        firstCompleteMonthStart = new Date(
          earliestTransactionDate.getFullYear(),
          earliestTransactionDate.getMonth() + 1,
          1
        );
      } else {
        // Earliest is on the 1st, so that month is complete
        firstCompleteMonthStart = new Date(
          earliestTransactionDate.getFullYear(),
          earliestTransactionDate.getMonth(),
          1
        );
      }
    }

    // Get all transactions for the user, grouped by month
    // Start from the 1st of the month, MAX_MONTHS ago, to ensure we capture complete months
    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - MAX_MONTHS);
    sinceDate.setDate(1); // Set to 1st of that month for complete month data

    // Fetch IDs of categories to ALWAYS exclude
    const alwaysExcludedCategories = [
      'Investment and Retirement Funds'
    ];

    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', alwaysExcludedCategories);

    let excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    // Parse additional category filters from query params
    const includeCategoryIdsParam = searchParams.get('includeCategoryIds');
    const excludeCategoryIdsParam = searchParams.get('excludeCategoryIds');

    if (excludeCategoryIdsParam) {
      const additionalExcludedIds = excludeCategoryIdsParam.split(',');
      excludedCategoryIds = [...excludedCategoryIds, ...additionalExcludedIds];
    }

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
          id,
          label
        ),
        transaction_splits (
          amount,
          is_settled
        ),
        transaction_repayments (
          id
        )
      `)
      .eq('accounts.user_id', userId)
      .not('date', 'is', null)
      .gte('date', sinceDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Apply exclusion filter
    if (excludedCategoryIds.length > 0) {
      query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
    }

    // Apply inclusion filter if provided
    if (includeCategoryIdsParam) {
      query = query.in('category_id', includeCategoryIdsParam.split(','));
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
      // Exclude matched transfers (pairs like credit card payment out + payment in)
      if (matchedIds.has(transaction.id)) return;

      // Exclude repayment transactions from counting as income (or spending)
      if (transaction.transaction_repayments && transaction.transaction_repayments.length > 0) return;

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

      // Calculate settled reimbursement amount
      const settledReimbursement = transaction.transaction_splits?.reduce((sum, split) => {
        return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
      }, 0) || 0;

      monthlyData[monthKey].transactionCount++;

      let adjustedAmount = 0;

      if (amount < 0) {
        // Negative amount = spending (debit)
        // Adjust spending: subtract settled reimbursements from absolute spending
        const adjustedSpending = Math.max(0, Math.abs(amount) - settledReimbursement);
        monthlyData[monthKey].spending += adjustedSpending;
        adjustedAmount = -adjustedSpending;
      } else if (amount > 0) {
        // Positive amount = earning (credit)
        monthlyData[monthKey].earning += amount;
        adjustedAmount = amount;
      }

      monthlyData[monthKey].netAmount += adjustedAmount;
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

    // Get current month to mark it as incomplete
    const nowForExclusion = new Date();
    const currentYearForExclusion = nowForExclusion.getFullYear();
    const currentMonthForExclusion = nowForExclusion.getMonth() + 1; // 1-12

    // Mark months as complete or incomplete and filter incomplete first months
    const processedMonths = result
      .map(month => {
        const isCurrentMonth = month.year === currentYearForExclusion && month.monthNumber === currentMonthForExclusion;

        // Check if month is before we had complete data
        let isIncompleteFirstMonth = false;
        if (firstCompleteMonthStart) {
          const monthStart = new Date(month.year, month.monthNumber - 1, 1);
          if (monthStart < firstCompleteMonthStart) {
            isIncompleteFirstMonth = true;
          }
        }

        return {
          ...month,
          isCurrentMonth,
          isComplete: !isCurrentMonth && !isIncompleteFirstMonth
        };
      })
      // Still filter out incomplete first months (not useful for display)
      .filter(month => !month.isIncompleteFirstMonth || month.isCurrentMonth);

    // Get only completed months for average calculation
    const completedMonths = processedMonths.filter(month => month.isComplete);

    // Limit to the last N completed months + include current month if present
    const limitedCompletedMonths = completedMonths.slice(-MAX_MONTHS);

    // Build final result: completed months + current month (if it exists and we have room)
    const currentMonth = processedMonths.find(m => m.isCurrentMonth);
    const limitedResult = currentMonth
      ? [...limitedCompletedMonths, currentMonth]
      : limitedCompletedMonths;

    // Log calculation details for debugging
    console.log(`[spending-earning] Calculation for userId=${userId}, requested months=${MAX_MONTHS}`);
    console.log(`[spending-earning] Total transactions fetched: ${transactions.length}`);
    console.log(`[spending-earning] Matched transfers (excluded): ${matchedIds.size}`);
    const transferCount = transactions.filter(tx => isTransfer(tx) && !matchedIds.has(tx.id)).length;
    console.log(`[spending-earning] Unmatched transfers (excluded): ${transferCount}`);
    console.log(`[spending-earning] Total monthly data entries: ${result.length}`);
    console.log(`[spending-earning] Current month (${monthNames[currentMonthForExclusion - 1]} ${currentYearForExclusion}) excluded from calculation`);
    console.log(`[spending-earning] Completed months available: ${completedMonths.length}`);
    result.forEach(month => {
      const isCurrentMonth = month.year === currentYearForExclusion && month.monthNumber === currentMonthForExclusion;
      const status = isCurrentMonth ? '[CURRENT - EXCLUDED]' : '';
      console.log(`[spending-earning] ${month.monthName} ${month.year} ${status}: earning=$${month.earning.toFixed(2)}, spending=$${month.spending.toFixed(2)}, transactions=${month.transactionCount}`);
    });
    console.log(`[spending-earning] Using last ${MAX_MONTHS} completed months: ${limitedResult.length} months`);
    limitedResult.forEach(month => {
      console.log(`[spending-earning]   - ${month.monthName} ${month.year}: earning=$${month.earning.toFixed(2)}`);
    });
    const totalEarning = limitedResult.reduce((sum, month) => sum + month.earning, 0);
    const avgEarning = limitedResult.length > 0 ? totalEarning / limitedResult.length : 0;
    console.log(`[spending-earning] Total earning (${limitedResult.length} months): $${totalEarning.toFixed(2)}`);
    console.log(`[spending-earning] Average monthly earning: $${avgEarning.toFixed(2)}`);

    if (DEBUG) console.log(`📊 Monthly Spending & Earning: months=${limitedResult.length} (cap=${MAX_MONTHS})`);

    // Calculate Month-over-Month (MoM) change for the current month vs same period last month
    // Reuse the date from exclusion check (or create new one for MoM calculation)
    const nowForMoM = new Date();
    const currentMonthForMoM = nowForMoM.getMonth(); // 0-11
    const currentYearForMoM = nowForMoM.getFullYear();
    const currentDayForMoM = nowForMoM.getDate();

    // Handle edge case for January (previous month is December of previous year)
    const lastMonthDate = new Date(nowForMoM);
    lastMonthDate.setMonth(nowForMoM.getMonth() - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    // Get number of days in last month to handle edge cases (e.g. March 30 vs Feb 28)
    const daysInLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
    const comparisonDay = Math.min(currentDayForMoM, daysInLastMonth);

    let currentMonthIncome = 0;
    let currentMonthSpending = 0;
    let lastMonthIncome = 0;
    let lastMonthSpending = 0;

    transactions.forEach(tx => {
      if (matchedIds.has(tx.id)) return;
      // Exclude ALL transfers from income calculation (matched or unmatched)
      if (isTransfer(tx)) return;
      // Exclude repayment transactions from counting as income (or spending)
      if (tx.transaction_repayments && tx.transaction_repayments.length > 0) return;
      if (!tx.date) return;

      // We need to parse the date string "YYYY-MM-DD" manually to avoid timezone issues
      const [yStr, mStr, dStr] = tx.date.split('-');
      const year = parseInt(yStr);
      const month = parseInt(mStr) - 1; // 0-11
      const day = parseInt(dStr);
      const amount = parseFloat(tx.amount);

      // Calculate settled reimbursement amount
      const settledReimbursement = tx.transaction_splits?.reduce((sum, split) => {
        return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
      }, 0) || 0;

      // Current Month MTD
      if (year === currentYearForMoM && month === currentMonthForMoM && day <= currentDayForMoM) {
        if (amount > 0) currentMonthIncome += amount;
        else currentMonthSpending += Math.max(0, Math.abs(amount) - settledReimbursement);
      }

      // Last Month MTD
      if (year === lastMonthYear && month === lastMonth && day <= comparisonDay) {
        if (amount > 0) lastMonthIncome += amount;
        else lastMonthSpending += Math.max(0, Math.abs(amount) - settledReimbursement);
      }
    });

    const incomeChange = lastMonthIncome === 0 ? 0 : ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100;
    const spendingChange = lastMonthSpending === 0 ? 0 : ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;

    if (DEBUG) console.log(`📊 MoM Comparison: Income ${incomeChange.toFixed(1)}%, Spending ${spendingChange.toFixed(1)}%`);

    return Response.json({
      data: limitedResult,
      summary: {
        totalMonths: limitedResult.length,
        totalSpending: limitedResult.reduce((sum, month) => sum + month.spending, 0),
        totalEarning: limitedResult.reduce((sum, month) => sum + month.earning, 0),
        totalTransactions: limitedResult.reduce((sum, month) => sum + month.transactionCount, 0)
      },
      momComparison: {
        incomeChange,
        spendingChange,
        currentMonthIncome,
        lastMonthIncome,
        currentMonthSpending,
        lastMonthSpending
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
