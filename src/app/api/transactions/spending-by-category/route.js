import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'spending'; // 'spending' or 'income'
    const daysParam = parseInt(searchParams.get('days') || '90', 10);
    const MAX_DAYS = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (true) console.log(`Fetching ${type} by category for user:`, userId, 'days:', daysParam);

    // Get transactions grouped by category
    const since = new Date();
    since.setDate(since.getDate() - MAX_DAYS);

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        amount,
        system_categories (
          id,
          label,
          category_groups (
            id,
            name,
            hex_color,
            icon_lib,
            icon_name
          )
        ),
        accounts!inner (
          user_id
        )
      `)
      .eq('accounts.user_id', userId)
      .not('system_categories', 'is', null)
      .gte('datetime', since.toISOString());

    // Filter by type
    if (type === 'income') {
      query = query.gt('amount', 0);
    } else {
      query = query.lt('amount', 0);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching spending by category:', error);
      return Response.json(
        { error: 'Failed to fetch spending data' },
        { status: 500 }
      );
    }

    // Group transactions by category and calculate totals
    const categoryData = {};

    transactions.forEach(transaction => {
      const category = transaction.system_categories;
      if (!category) return;

      const categoryKey = category.id;
      const amount = Math.abs(parseFloat(transaction.amount)); // Convert to positive amount for display

      if (!categoryData[categoryKey]) {
        categoryData[categoryKey] = {
          id: category.id,
          label: category.label,
          hex_color: category.category_groups?.hex_color || '#6B7280',
          group_name: category.category_groups?.name || 'Other',
          icon_lib: category.category_groups?.icon_lib || null,
          icon_name: category.category_groups?.icon_name || null,
          total_spent: 0,
          transaction_count: 0
        };
      }

      categoryData[categoryKey].total_spent += amount;
      categoryData[categoryKey].transaction_count += 1;
    });

    // Convert to array and sort by amount (descending)
    const categoriesArray = Object.values(categoryData)
      .sort((a, b) => b.total_spent - a.total_spent);

    // Calculate total spending for percentage calculations
    const totalSpending = categoriesArray.reduce((sum, category) => sum + category.total_spent, 0);

    // Add percentage to each category and filter out categories < 1%
    const filteredCategories = categoriesArray
      .map(category => ({
        ...category,
        percentage: totalSpending > 0 ? (category.total_spent / totalSpending) * 100 : 0
      }))
      .filter(category => category.percentage >= 1.0); // Only include categories >= 1%

    if (true) console.log(`📊 ${type} by Category: categories=${filteredCategories.length} windowDays=${MAX_DAYS}`, filteredCategories.slice(0, 3));

    return Response.json({
      categories: filteredCategories,
      totalSpending,
      totalCategories: categoriesArray.length,
      filteredCount: filteredCategories.length
    });

  } catch (error) {
    console.error('Error in spending by category API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

