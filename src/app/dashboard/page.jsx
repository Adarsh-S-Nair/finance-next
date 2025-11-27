"use client";

import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../config/dashboardLayout";
import MonthlyOverviewCard from "../../components/dashboard/MonthlyOverviewCard";
import DashboardNetWorthCard from "../../components/dashboard/DashboardNetWorthCard";
import IncomeCard from "../../components/dashboard/IncomeCard";
import SpendingCard from "../../components/dashboard/SpendingCard";
import PlaceholderCard from "../../components/dashboard/PlaceholderCard";

// Map string keys to actual components
const componentMap = {
  'DashboardNetWorthCard': DashboardNetWorthCard,
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,
  'IncomeCard': IncomeCard,
  'SpendingCard': SpendingCard,
  'PlaceholderCard': PlaceholderCard,
};

export default function DashboardPage() {
  const { user } = useUser();

  // Helper to render a single item (component, container, or spacer)
  const renderItem = (item, index) => {
    // Handle Spacer
    if (item.type === 'spacer') {
      return (
        <div
          key={`spacer-${index}`}
          className={`
            ${item.colSpan?.lg ? `lg:col-span-${item.colSpan.lg}` : ''}
            ${item.className || ''}
          `}
        />
      );
    }

    // Handle Container (Nested Grid)
    if (item.type === 'container') {
      return (
        <div
          key={`container-${index}`}
          className={`
            ${item.colSpan?.lg ? `lg:col-span-${item.colSpan.lg}` : ''}
            grid grid-cols-1 ${item.gridCols?.sm ? `sm:grid-cols-${item.gridCols.sm}` : ''} 
            gap-${item.gap || 6} h-full
          `}
        >
          {item.items.map((subItem, subIndex) => renderItem(subItem, subIndex))}
        </div>
      );
    }

    // Handle Component
    const Component = componentMap[item.component];
    if (!Component) return null;

    return (
      <div
        key={`item-${index}`}
        className={`
          ${item.colSpan?.lg ? `lg:col-span-${item.colSpan.lg}` : ''}
          ${item.height || 'h-full'}
        `}
      >
        <Component {...(item.props || {})} />
      </div>
    );
  };

  return (
    <PageContainer title="Dashboard">
      <div className="space-y-6">
        {dashboardLayout.map((row) => (
          <div key={row.id} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {row.items.map((item, index) => renderItem(item, index))}
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
