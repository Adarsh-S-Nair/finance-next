import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const categoryId = searchParams.get('categoryId');
        const monthsParam = parseInt(searchParams.get('months') || '4', 10);
        const MAX_MONTHS = Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 12) : 4;

        if (!userId) {
            return Response.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (!categoryId) {
            return Response.json(
                { error: 'Category ID is required' },
                { status: 400 }
            );
        }

        // Get transactions for this category, going back MAX_MONTHS
        const sinceDate = new Date();
        sinceDate.setMonth(sinceDate.getMonth() - MAX_MONTHS);
        sinceDate.setDate(1); // Start from 1st of month for complete months

        // Determine the user's earliest transaction date across all accounts
        // This tells us when we have complete data from
        const { data: earliestTxResult } = await supabaseAdmin
            .from('transactions')
            .select('date, accounts!inner(user_id)')
            .eq('accounts.user_id', userId)
            .order('date', { ascending: true })
            .limit(1);

        const earliestTransactionDate = earliestTxResult?.[0]?.date
            ? new Date(earliestTxResult[0].date)
            : null;

        const { data: transactions, error } = await supabaseAdmin
            .from('transactions')
            .select(`
        id,
        amount,
        date,
        category_id,
        transaction_splits (
          amount,
          is_settled
        ),
        accounts!inner (
          user_id
        )
      `)
            .eq('accounts.user_id', userId)
            .eq('category_id', categoryId)
            .gte('date', sinceDate.toISOString().split('T')[0])
            .lt('amount', 0) // Only spending (negative amounts)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching category history:', error);
            return Response.json(
                { error: 'Failed to fetch category history' },
                { status: 500 }
            );
        }

        // Group by month
        const monthlyData = {};

        transactions.forEach(tx => {
            if (!tx.date) return;

            const [yearStr, monthStr, dayStr] = tx.date.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);
            const day = parseInt(dayStr);
            const monthKey = `${yearStr}-${monthStr}`;

            const rawAmount = Math.abs(parseFloat(tx.amount));

            // Calculate settled reimbursement amount
            const settledReimbursement = tx.transaction_splits?.reduce((sum, split) => {
                return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
            }, 0) || 0;

            const adjustedAmount = Math.max(0, rawAmount - settledReimbursement);

            if (adjustedAmount === 0) return;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    year: year,
                    monthNumber: month,
                    spending: 0,
                    transactionCount: 0,
                    earliestDay: day,
                    latestDay: day
                };
            }

            monthlyData[monthKey].spending += adjustedAmount;
            monthlyData[monthKey].transactionCount += 1;
            // Track earliest and latest transaction days in the month
            monthlyData[monthKey].earliestDay = Math.min(monthlyData[monthKey].earliestDay, day);
            monthlyData[monthKey].latestDay = Math.max(monthlyData[monthKey].latestDay, day);
        });

        // Convert to array and sort by date
        const monthlyArray = Object.values(monthlyData).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.monthNumber - b.monthNumber;
        });

        // Add month names
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        // Exclude current month (incomplete) and months before we had complete account data
        // A month is considered complete if:
        // 1. It's not the current month
        // 2. The month started after we began syncing transactions (earliestTransactionDate)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const completedMonths = monthlyArray
            .filter(m => {
                // Exclude current month
                if (m.year === currentYear && m.monthNumber === currentMonth) {
                    return false;
                }

                // Exclude months that started before we had transaction data
                // This handles newly synced accounts where we don't have complete months
                if (earliestTransactionDate) {
                    const monthStart = new Date(m.year, m.monthNumber - 1, 1);
                    // Only include months that started on or after the 1st of the month
                    // when we have earliest transaction data
                    const earliestMonth = new Date(
                        earliestTransactionDate.getFullYear(),
                        earliestTransactionDate.getMonth(),
                        1
                    );
                    // If earliest transaction is after the 1st of its month, that month is incomplete
                    if (earliestTransactionDate.getDate() > 1) {
                        // Skip the month containing the earliest transaction (it's incomplete)
                        if (monthStart <= earliestMonth) {
                            return false;
                        }
                    } else {
                        // Earliest transaction is on the 1st, so that month is complete
                        if (monthStart < earliestMonth) {
                            return false;
                        }
                    }
                }

                return true;
            })
            .slice(-MAX_MONTHS);

        const result = completedMonths.map(m => ({
            ...m,
            monthName: monthNames[m.monthNumber - 1],
            spending: Math.round(m.spending)
        }));

        console.log(`[category-history] Category ${categoryId}: ${result.length} months of data`);

        return Response.json({
            data: result,
            categoryId,
            totalMonths: result.length
        });

    } catch (error) {
        console.error('Error in category history API:', error);
        return Response.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
