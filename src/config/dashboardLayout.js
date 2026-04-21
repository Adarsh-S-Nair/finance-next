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
    // Net Worth Banner (simple number + link to accounts)
    {
      id: 'net-worth-banner',
      component: 'NetWorthBanner',
    },
    // Monthly Overview Chart (full width, hero card)
    {
      id: 'monthly-overview',
      component: 'MonthlyOverviewCard',
      height: 'h-[400px]'
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
          mobileHeight: 'h-[380px] lg:h-full'
        },
        {
          id: 'top-categories',
          component: 'TopCategoriesCard',
          width: 'lg:w-[320px] lg:flex-shrink-0',
          mobileHeight: 'h-auto lg:h-full'
        }
      ],
      height: 'lg:h-[380px]'
    }
  ],

  // Sidebar (right side, narrower)
  sidebar: [
    {
      id: 'insights',
      component: 'InsightsCarousel',
    },
    {
      id: 'sidebar-group',
      type: 'row',
      className: 'flex flex-col md:flex-row lg:flex-col gap-10',
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
      id: 'top-holdings',
      component: 'TopHoldingsCard'
    }
  ]
};
