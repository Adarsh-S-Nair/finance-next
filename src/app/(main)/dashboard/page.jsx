"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { authFetch } from "../../../lib/api/fetch";
import PageContainer from "../../../components/layout/PageContainer";
import SpendingVsEarningCard from "../../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../../config/dashboardLayout";
import MonthlyOverviewCard from "../../../components/dashboard/MonthlyOverviewCard";
import RecentTransactionsCard from "../../../components/dashboard/RecentTransactionsCard";
import BudgetsCard from "../../../components/dashboard/BudgetsCard";
import TopCategoriesCard from "../../../components/dashboard/TopCategoriesCard";
import CalendarCard from "../../../components/dashboard/CalendarCard";
import FadeIn from "../../../components/ui/FadeIn";
import { capitalizeFirstOnly } from "../../../lib/utils/formatName";

// Map string keys to actual components
const componentMap = {
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,
  'RecentTransactionsCard': RecentTransactionsCard,
  'BudgetsCard': BudgetsCard,
  'TopCategoriesCard': TopCategoriesCard,
  'CalendarCard': CalendarCard,
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { accounts, loading: accountsLoading, initialized: accountsInitialized } = useAccounts();
  const [greeting, setGreeting] = useState("Dashboard");
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    if (user) {
      const hour = new Date().getHours();
      let timeGreeting = "Good morning";
      if (hour >= 12 && hour < 18) timeGreeting = "Good afternoon";
      if (hour >= 18 || hour < 5) timeGreeting = "Good evening";

      const meta = user.user_metadata || {};
      const first = meta.first_name || meta.name?.split(' ')[0] || meta.full_name?.split(' ')[0];
      const nameFromEmail = user.email?.split('@')[0];
      const name = first ? capitalizeFirstOnly(first) : (nameFromEmail ? capitalizeFirstOnly(nameFromEmail) : "User");

      setGreeting(`${timeGreeting}, ${name}`);
    }
  }, [user]);

  // Fetch consolidated dashboard summary (single DB round-trip for both chart cards)
  useEffect(() => {
    if (authLoading || !user?.id) return;
    authFetch('/api/dashboard/summary?months=6&categoryPeriod=thisMonth')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setSummaryData(data); })
      .catch(err => console.error('[dashboard] summary fetch error:', err));
  }, [authLoading, user?.id]);

  // Whether a component is a "main content" component (no card wrapper)
  const mainContentComponents = new Set([
    'MonthlyOverviewCard',
    'SpendingVsEarningCard',
    'TopCategoriesCard',
    'RecentTransactionsCard',
  ]);

  // Components that receive pre-fetched summary data from the dashboard
  const summaryDataMap = {
    'SpendingVsEarningCard': summaryData?.spendingEarning,
    'TopCategoriesCard': summaryData?.spendingByCategory,
  };

  // Helper to render a single item (or row of items)
  const renderItem = (item) => {
    if (item.type === 'row') {
      return (
        <div
          key={item.id}
          className={item.className || `flex flex-col lg:flex-row gap-8 ${item.height || ''}`}
        >
          {item.items.map((subItem) => {
            const Component = componentMap[subItem.component];
            if (!Component) return null;
            const isMain = mainContentComponents.has(subItem.component);
            const extraProps = summaryDataMap[subItem.component]
              ? { data: summaryDataMap[subItem.component] }
              : {};
            return (
              <div
                key={subItem.id}
                className={`${subItem.width || 'flex-1'} min-w-0 ${subItem.mobileHeight || ''} ${isMain ? 'border-b border-zinc-100 pb-8 lg:border-b-0 lg:pb-0 lg:border-r lg:border-zinc-100 lg:pr-8 last:border-0 last:pb-0 last:pr-0' : ''}`}
              >
                <Component {...(subItem.props || {})} {...extraProps} />
              </div>
            );
          })}
        </div>
      );
    }

    const Component = componentMap[item.component];
    if (!Component) return null;
    const extraProps = summaryDataMap[item.component]
      ? { data: summaryDataMap[item.component] }
      : {};

    return (
      <div key={item.id} className={item.height || ''}>
        <Component {...(item.props || {})} {...extraProps} />
      </div>
    );
  };

  const hasInstitutions = accounts.length > 0;

  useEffect(() => {
    if (accountsInitialized && !accountsLoading && !hasInstitutions) {
      router.replace("/setup");
    }
  }, [accountsInitialized, accountsLoading, hasInstitutions, router]);

  if (accountsInitialized && !accountsLoading && !hasInstitutions) {
    return null;
  }

  return (
    <PageContainer title={greeting} documentTitle="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-7 space-y-8">
          {dashboardLayout.main.map((item, i) => (
            <FadeIn key={item.id} delay={0.1 + i * 0.1}>
              {renderItem(item)}
            </FadeIn>
          ))}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-8">
          {dashboardLayout.sidebar.map((item, i) => (
            <FadeIn key={item.id} delay={0.2 + i * 0.15}>
              {renderItem(item)}
            </FadeIn>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
