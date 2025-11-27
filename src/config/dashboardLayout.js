/**
 * Dashboard Layout Configuration
 * 
 * Defines the grid layout for the dashboard.
 * - Rows are rendered sequentially.
 * - Items within a row are rendered in a grid.
 * - 'colSpan' defines how many columns an item takes (default 1).
 * - 'component' matches the key in the componentMap in DashboardPage.
 * - 'type: container' allows nesting a sub-grid.
 * - 'type: spacer' creates an empty space.
 */

export const dashboardLayout = [
  // Row 1: Key Metrics
  {
    id: 'row-metrics',
    items: [
      // Total Net Worth (1/3 width)
      {
        component: 'DashboardNetWorthCard',
        colSpan: { lg: 1 }
      },
      // Income & Spending Container (2/3 width)
      {
        type: 'container',
        colSpan: { lg: 2 },
        gridCols: { sm: 2 }, // Sub-grid with 2 columns
        gap: 6,
        items: [
          { component: 'IncomeCard' },
          { component: 'SpendingCard' }
        ]
      }
    ]
  },

  // Row 2: Monthly Overview
  {
    id: 'row-monthly-overview',
    items: [
      // Monthly Overview (2/3 width, Left)
      {
        component: 'MonthlyOverviewCard',
        colSpan: { lg: 2 }
      },
      // Placeholder (1/3 width, Right)
      {
        component: 'PlaceholderCard',
        colSpan: { lg: 1 },
        props: { title: 'Widgets', description: 'Additional widgets' },
        className: 'hidden lg:block'
      }
    ]
  },

  // Row 3: Cashflow
  {
    id: 'row-cashflow',
    items: [
      // Placeholder (1/3 width, Left)
      {
        component: 'PlaceholderCard',
        colSpan: { lg: 1 },
        props: { title: 'Analysis', description: 'Deeper insights' },
        className: 'hidden lg:block'
      },
      // Cashflow Chart (2/3 width, Right)
      {
        component: 'SpendingVsEarningCard',
        colSpan: { lg: 2 },
        height: 'h-[400px]'
      }
    ]
  }
];
