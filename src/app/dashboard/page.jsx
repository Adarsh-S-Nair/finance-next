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
import Dropdown from "../../components/ui/Dropdown";
import Button from "../../components/Button";

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

  // Tailwind class maps to ensure classes are generated
  const colSpanMap = {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3',
  };

  const gridColsMap = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
  };

  // Helper to render a single item (component, container, or spacer)
  const renderItem = (item, index) => {
    const colSpanClass = item.colSpan?.lg ? colSpanMap[item.colSpan.lg] : '';

    // Handle Spacer
    if (item.type === 'spacer') {
      return (
        <div
          key={`spacer-${index}`}
          className={`
            ${colSpanClass}
            ${item.className || ''}
          `}
        />
      );
    }

    // Handle Container (Nested Grid)
    if (item.type === 'container') {
      const gridColsClass = item.gridCols?.sm ? gridColsMap[item.gridCols.sm] : '';
      return (
        <div
          key={`container-${index}`}
          className={`
            ${colSpanClass}
            grid grid-cols-1 ${gridColsClass}
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
          ${colSpanClass}
          ${item.height || 'h-full'}
        `}
      >
        <Component {...(item.props || {})} />
      </div>
    );
  };

  return (
    <PageContainer
      title="Dashboard"
      action={
        <Dropdown
          label="Test Dropdown"
          size="sm"
          items={[
            { label: "Option 1", onClick: () => console.log("Option 1 clicked") },
            { label: "Option 2", onClick: () => console.log("Option 2 clicked") },
            { label: "Option 3", onClick: () => console.log("Option 3 clicked") },
            { label: "Disabled Option", disabled: true },
          ]}
          align="right"
        />
      }
    >
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
