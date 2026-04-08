/**
 * Dashboard Layout Configuration
 *
 * - 'main' section: primary dashboard cards (left side, 7 cols)
 * - 'sidebar' section: supplementary cards (right side, 3 cols)
 * - 'component' matches the key in componentMap in DashboardPage
 */

export const dashboardLayout = {
  // Main content area (left side, wider)
  main: [
    // Monthly Overview Chart (full width, hero card)
    {
      id: 'monthly-overview',
      component: 'MonthlyOverviewCard',
      height: 'h-[420px]'
    },
    // Cashflow + Top Categories (stacked on mobile, side-by-side on desktop)
    {
      id: 'cashflow-row',
      type: 'row',
      items: [
        {
          id: 'cashflow',
          component: 'SpendingVsEarningCard',
          width: 'lg:flex-1 lg:min-w-0',
          mobileHeight: 'h-[400px] lg:h-full'
        },
        {
          id: 'top-categories',
          component: 'TopCategoriesCard',
          width: 'lg:w-[320px] lg:flex-shrink-0',
          mobileHeight: 'h-[440px] lg:h-full'
        }
      ],
      height: 'lg:h-[440px]'
    }
  ],

  // Sidebar (right side, narrower)
  sidebar: [
    {
      id: 'market-indices',
      component: 'MarketIndicesCard',
    },
    {
      id: 'sidebar-group',
      type: 'row',
      className: 'flex flex-col md:flex-row lg:flex-col gap-5',
      items: [
        {
          id: 'budgets',
          component: 'BudgetsCard'
        },
        {
          id: 'calendar',
          component: 'CalendarCard'
        }
      ]
    },
    {
      id: 'recent-transactions',
      component: 'RecentTransactionsCard'
    }
  ]
};
