"use client";

import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../config/dashboardLayout";
import MonthlyOverviewCard from "../../components/dashboard/MonthlyOverviewCard";
import DashboardNetWorthCard from "../../components/dashboard/DashboardNetWorthCard";

import PlaceholderCard from "../../components/dashboard/PlaceholderCard";
import Dropdown from "../../components/ui/Dropdown";
import Button from "../../components/Button";

import { FiLoader } from "react-icons/fi";

// Map string keys to actual components
const componentMap = {
  'DashboardNetWorthCard': DashboardNetWorthCard,
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,

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
    <PageContainer
      title="Dashboard"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {dashboardLayout.main.map((item) => renderItem(item))}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {dashboardLayout.sidebar.map((item) => renderItem(item))}
        </div>
      </div>
    </PageContainer>
  );
}
