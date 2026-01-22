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

            const [yearStr, monthStr] = tx.date.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);
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
                    transactionCount: 0
                };
            }

            monthlyData[monthKey].spending += adjustedAmount;
            monthlyData[monthKey].transactionCount += 1;
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

        // Exclude current month (incomplete) and take last MAX_MONTHS completed months
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const completedMonths = monthlyArray
            .filter(m => !(m.year === currentYear && m.monthNumber === currentMonth))
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
