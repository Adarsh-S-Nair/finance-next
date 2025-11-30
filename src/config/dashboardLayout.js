/**
 * Dashboard Layout Configuration
 * 
 * Defines the layout for the dashboard with a main content area and sidebar.
 * - 'main' section contains the primary dashboard cards (left side)
 * - 'sidebar' section contains supplementary cards (right side)
 * - 'component' matches the key in the componentMap in DashboardPage
 */

export const dashboardLayout = {
  // Main content area (left side, wider)
  main: [
    // Monthly Overview Card
    {
      id: 'monthly-overview',
      component: 'MonthlyOverviewCard'
    },
    // Cashflow Chart
    {
      id: 'cashflow',
      component: 'SpendingVsEarningCard',
      height: 'h-[400px]'
    }
  ],

  // Sidebar (right side, narrower)
  sidebar: [
    // Net Worth Card
    {
      id: 'net-worth',
      component: 'DashboardNetWorthCard'
    },

    // Recurring Transactions
    {
      id: 'recurring-transactions',
      component: 'RecurringTransactionsCard'
    }
  ]
};
