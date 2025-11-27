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

  // Helper to render a single item
  const renderItem = (item) => {
    const Component = componentMap[item.component];
    if (!Component) return null;

    return (
      <div
        key={item.id}
        className={item.height || ''}
      >
        <Component {...(item.props || {})} />
      </div>
    );
  };

  return (
    <PageContainer title="Dashboard">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content Area */}
        <div className="flex-1 lg:w-0 space-y-6">
          {dashboardLayout.main.map((item) => renderItem(item))}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 xl:w-96 space-y-6">
          {dashboardLayout.sidebar.map((item) => renderItem(item))}
        </div>
      </div>
    </PageContainer>
  );
}
