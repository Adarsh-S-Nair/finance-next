"use client";

import { useState, useEffect } from "react";
import { useUser } from "../../../components/UserProvider";
import PageContainer from "../../../components/PageContainer";
import SpendingVsEarningCard from "../../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../../config/dashboardLayout";
import MonthlyOverviewCard from "../../../components/dashboard/MonthlyOverviewCard";
import DashboardNetWorthCard from "../../../components/dashboard/DashboardNetWorthCard";
import RecurringTransactionsCard from "../../../components/dashboard/RecurringTransactionsCard";
import PlaceholderCard from "../../../components/dashboard/PlaceholderCard";

import IncomeCard from "../../../components/dashboard/IncomeCard";
import SpendingCard from "../../../components/dashboard/SpendingCard";
import BudgetsCard from "../../../components/dashboard/BudgetsCard";
import TopCategoriesCard from "../../../components/dashboard/TopCategoriesCard";

// Map string keys to actual components
const componentMap = {
  'DashboardNetWorthCard': DashboardNetWorthCard,
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,
  'PlaceholderCard': PlaceholderCard,
  'RecurringTransactionsCard': RecurringTransactionsCard,
  'IncomeCard': IncomeCard,
  'SpendingCard': SpendingCard,
  'BudgetsCard': BudgetsCard,
  'TopCategoriesCard': TopCategoriesCard,
};

export default function DashboardPage() {
  const { user } = useUser();
  const [greeting, setGreeting] = useState("Dashboard");
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const handleScroll = (e) => {
    // Calculate active index based on scroll position
    // Cards are 85vw wide on mobile
    const cardWidth = window.innerWidth * 0.85;
    const index = Math.round(e.target.scrollLeft / cardWidth);
    setActiveCardIndex(index);
  };

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
    <PageContainer title={greeting} documentTitle="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top Row - Net Worth, Income, Spending */}
          {dashboardLayout.top && (
            <>
              <div
                className="flex md:grid md:grid-cols-3 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none gap-4 md:gap-6 pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide"
                onScroll={handleScroll}
              >
                {dashboardLayout.top.map((item) => {
                  const Component = componentMap[item.component];
                  if (!Component) return null;
                  return (
                    <div
                      key={item.id}
                      className={`${item.height || ''} min-w-[85vw] md:min-w-0 snap-center shrink-0`}
                    >
                      <Component {...(item.props || {})} />
                    </div>
                  );
                })}
              </div>

              {/* Mobile Pagination Dots */}
              <div className="flex justify-center gap-2 md:hidden -mt-2 mb-4">
                {dashboardLayout.top.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i === activeCardIndex ? "bg-[var(--color-fg)]" : "bg-[var(--color-muted)]/30"
                      }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Main Cards */}
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
