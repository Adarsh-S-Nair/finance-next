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
    // Paired row: line chart + donut share the same month dropdown
    // (the dropdown lives in MonthlyOverviewCard's header but the
    // selected month is owned by the dashboard page and threaded into
    // both cards). Line chart shows the trend; donut shows where the
    // money went — answering the same "what about this month?"
    // question with two complementary views.
    {
      id: 'monthly-row',
      type: 'row',
      items: [
        {
          id: 'monthly-overview',
          component: 'MonthlyOverviewCard',
          width: 'lg:flex-1 lg:min-w-0',
          mobileHeight: 'h-[400px] lg:h-full',
        },
        {
          id: 'top-categories',
          component: 'TopCategoriesCard',
          width: 'lg:w-[320px] lg:flex-shrink-0',
          mobileHeight: 'h-auto lg:h-full',
        },
      ],
      height: 'lg:h-[400px]',
    },
    // Cashflow stands on its own row now — different question
    // (income vs. spending over 6 months) so it shouldn't share the
    // monthly-row's period dropdown.
    {
      id: 'cashflow',
      component: 'SpendingVsEarningCard',
      height: 'h-[380px]',
    },
  ],

  // Sidebar (right side, narrower). The assistant signal block renders
  // above these (directly in the dashboard page, not config-driven) —
  // it replaced the InsightsCarousel, whose job it absorbs.
  sidebar: [
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
