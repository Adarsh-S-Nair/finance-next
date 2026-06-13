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
    // Upcoming bills — "what's about to hit". Third and last of the
    // three ambient questions the main column answers (net worth,
    // spending this month, upcoming charges).
    {
      id: 'calendar',
      component: 'CalendarCard',
    },
  ],

  // Sidebar (right side, narrower) — reserved for the assistant rail,
  // which the dashboard page renders directly (it isn't config-driven).
  // The widgets that used to live here (InsightsCarousel, BudgetsCard,
  // GoalsCard, TopHoldingsCard) and the SpendingVsEarningCard cashflow
  // chart were demoted, not deleted: every one duplicates a page that
  // already exists in the nav. Re-add an entry here to bring one back.
  sidebar: [],
};
