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

    console.log('Fetching spending by category for user:', userId);

    // Get spending transactions grouped by category
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        amount,
        system_categories (
          id,
          label,
          hex_color,
          category_groups (
            id,
            name,
            icon_lib,
            icon_name
          )
        ),
        accounts!inner (
          user_id
        )
      `)
      .eq('accounts.user_id', userId)
      .lt('amount', 0) // Only spending transactions (negative amounts)
      .not('system_categories', 'is', null);

    if (error) {
      console.error('Error fetching spending by category:', error);
      return Response.json(
        { error: 'Failed to fetch spending data' },
        { status: 500 }
      );
    }

    // Group transactions by category and calculate totals
    const categorySpending = {};
    
    transactions.forEach(transaction => {
      const category = transaction.system_categories;
      if (!category) return;
      
      const categoryKey = category.id;
      const amount = Math.abs(parseFloat(transaction.amount)); // Convert to positive spending amount
      
      if (!categorySpending[categoryKey]) {
        categorySpending[categoryKey] = {
          id: category.id,
          label: category.label,
          hex_color: category.hex_color,
          group_name: category.category_groups?.name || 'Other',
          icon_lib: category.category_groups?.icon_lib || null,
          icon_name: category.category_groups?.icon_name || null,
          total_spent: 0,
          transaction_count: 0
        };
      }
      
      categorySpending[categoryKey].total_spent += amount;
      categorySpending[categoryKey].transaction_count += 1;
    });

    // Convert to array and sort by spending amount (descending)
    const categoriesArray = Object.values(categorySpending)
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

    console.log('📊 Spending by Category:', {
      totalCategories: categoriesArray.length,
      filteredCategories: filteredCategories.length,
      totalSpending,
      categories: filteredCategories
    });

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

