/**
 * Dashboard Layout Configuration
 *
 * - 'main' section: primary dashboard cards (left side, 7 cols)
 * - 'sidebar' section: supplementary cards (right side, 3 cols)
 * - 'component' matches the key in componentMap in DashboardPage
 */

interface DashboardCard {
  id: string;
  component: string;
  height?: string;
  mobileHeight?: string;
  width?: string;
}

interface DashboardRow {
  id: string;
  type: 'row';
  items: DashboardCard[];
  height?: string;
  className?: string;
}

type DashboardItem = DashboardCard | DashboardRow;

interface DashboardLayout {
  main: DashboardItem[];
  sidebar: DashboardItem[];
}

export const dashboardLayout: DashboardLayout = {
  // Main content area (left side, wider)
  main: [
    {
      id: 'net-worth-banner',
      component: 'NetWorthBanner',
    },
    {
      id: 'monthly-overview',
      component: 'MonthlyOverviewCard',
      height: 'h-[400px]',
    },
    {
      id: 'cashflow-row',
      type: 'row',
      items: [
        {
          id: 'cashflow',
          component: 'SpendingVsEarningCard',
          width: 'lg:flex-1 lg:min-w-0',
          mobileHeight: 'h-[380px] lg:h-full',
        },
        {
          id: 'top-categories',
          component: 'TopCategoriesCard',
          width: 'lg:w-[320px] lg:flex-shrink-0',
          mobileHeight: 'h-auto lg:h-full',
        },
      ],
      height: 'lg:h-[380px]',
    },
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
          component: 'BudgetsCard',
        },
        {
          id: 'goals',
          component: 'GoalsCard',
        },
        {
          id: 'calendar',
          component: 'CalendarCard',
        },
      ],
    },
    {
      id: 'top-holdings',
      component: 'TopHoldingsCard',
    },
  ],
};
