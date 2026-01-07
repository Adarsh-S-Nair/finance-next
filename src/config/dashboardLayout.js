/**
 * Dashboard Layout Configuration
 * 
 * Defines the layout for the dashboard with a main content area and sidebar.
 * - 'main' section contains the primary dashboard cards (left side)
 * - 'sidebar' section contains supplementary cards (right side)
 * - 'component' matches the key in the componentMap in DashboardPage
 */

export const dashboardLayout = {
  // Top row (3 columns)
  // Top row (3 columns)
  top: null,

  // Main content area (left side, wider)
  main: [
    // Monthly Overview Chart (full width)
    {
      id: 'monthly-overview',
      component: 'MonthlyOverviewCard',
      height: 'h-[360px]'
    },
    // Cashflow + Top Categories (2/3 - 1/3 row)
    {
      id: 'cashflow-row',
      type: 'row',
      items: [
        {
          id: 'cashflow',
          component: 'SpendingVsEarningCard',
          width: 'w-2/3'
        },
        {
          id: 'top-categories',
          component: 'TopCategoriesCard',
          width: 'w-1/3'
        }
      ],
      height: 'h-[400px]'
    }
  ],

  // Sidebar (right side, narrower)
  sidebar: [
    // Budgets Widget
    {
      id: 'budgets',
      component: 'BudgetsCard'
    },
    // Calendar (Recurring Transactions)
    {
      id: 'calendar',
      component: 'CalendarCard'
    }
  ]
};
