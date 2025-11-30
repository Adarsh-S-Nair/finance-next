"use client";

import { useState, useEffect } from "react";
import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../config/dashboardLayout";
import MonthlyOverviewCard from "../../components/dashboard/MonthlyOverviewCard";
import DashboardNetWorthCard from "../../components/dashboard/DashboardNetWorthCard";
import RecurringTransactionsCard from "../../components/dashboard/RecurringTransactionsCard";
import PlaceholderCard from "../../components/dashboard/PlaceholderCard";

// Map string keys to actual components
const componentMap = {
  'DashboardNetWorthCard': DashboardNetWorthCard,
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,
  'PlaceholderCard': PlaceholderCard,
  'RecurringTransactionsCard': RecurringTransactionsCard,
};

export default function DashboardPage() {
  const { user } = useUser();
  const [greeting, setGreeting] = useState("Dashboard");

  useEffect(() => {
    if (user) {
      const hour = new Date().getHours();
      let timeGreeting = "Good morning";
      if (hour >= 12 && hour < 18) timeGreeting = "Good afternoon";
      if (hour >= 18 || hour < 5) timeGreeting = "Good evening";

      const meta = user.user_metadata || {};
      const first = meta.first_name || meta.name?.split(' ')[0] || meta.full_name?.split(' ')[0];
      const nameFromEmail = user.email?.split('@')[0];
      const name = first || (nameFromEmail ? nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1) : "User");

      setGreeting(`${timeGreeting}, ${name}`);
    }
  }, [user]);

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
    <PageContainer title={greeting}>
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-7 space-y-6">
          {dashboardLayout.main.map((item) => renderItem(item))}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          {dashboardLayout.sidebar.map((item) => renderItem(item))}
        </div>
      </div>
    </PageContainer>
  );
}
