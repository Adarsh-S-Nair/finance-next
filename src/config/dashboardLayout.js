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
    // Cashflow + Top Categories (stacked on mobile, side-by-side on desktop)
    {
      id: 'cashflow-row',
      type: 'row',
      items: [
        {
          id: 'cashflow',
          component: 'SpendingVsEarningCard',
          width: 'lg:flex-1 lg:min-w-0',
          mobileHeight: 'h-[350px] lg:h-full'
        },
        {
          id: 'top-categories',
          component: 'TopCategoriesCard',
          width: 'lg:w-[320px] lg:flex-shrink-0',
          mobileHeight: 'h-[400px] lg:h-full'
        }
      ],
      height: 'lg:h-[400px]'
    }
  ],

  // Sidebar (right side, narrower)
  // Sidebar (right side, narrower)
  sidebar: [
    {
      id: 'sidebar-group',
      type: 'row',
      // Mobile: stack, Tablet: side-by-side (bottom of screen), Desktop: stack (right sidebar)
      className: 'flex flex-col md:flex-row lg:flex-col gap-6',
      items: [
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
    }
  ]
};
