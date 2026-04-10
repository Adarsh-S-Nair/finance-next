"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { authFetch } from "../../../lib/api/fetch";
import PageContainer from "../../../components/layout/PageContainer";
import SpendingVsEarningCard from "../../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../../config/dashboardLayout";
import MonthlyOverviewCard from "../../../components/dashboard/MonthlyOverviewCard";
import TopHoldingsCard from "../../../components/dashboard/TopHoldingsCard";
import BudgetsCard from "../../../components/dashboard/BudgetsCard";
import TopCategoriesCard from "../../../components/dashboard/TopCategoriesCard";
import CalendarCard from "../../../components/dashboard/CalendarCard";
import NetWorthBanner from "../../../components/dashboard/NetWorthBanner";
import { capitalizeFirstOnly } from "../../../lib/utils/formatName";
import UpgradeBanner from "../../../components/dashboard/UpgradeBanner";

// Map string keys to actual components
const componentMap = {
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,
  'TopHoldingsCard': TopHoldingsCard,
  'BudgetsCard': BudgetsCard,
  'TopCategoriesCard': TopCategoriesCard,
  'CalendarCard': CalendarCard,
  'NetWorthBanner': NetWorthBanner,
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isPro, loading: authLoading, refreshProfile } = useUser();
  const { accounts, loading: accountsLoading, initialized: accountsInitialized } = useAccounts();
  const [greeting, setGreeting] = useState("Dashboard");
  const [summaryData, setSummaryData] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);

  // Handle return from Stripe Checkout (?upgraded=1)
  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return;
    if (!user) return;

    async function syncAndRefresh() {
      try {
        await authFetch('/api/stripe/sync', { method: 'POST' });
      } catch (e) {
        console.warn('[dashboard] stripe sync failed:', e);
      }
      await refreshProfile();

      // Trigger recurring transactions sync in the background now that the
      // user has Pro access. This runs against existing Plaid items — no
      // re-consent needed.
      authFetch('/api/plaid/recurring/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(e => console.warn('[dashboard] recurring sync failed:', e));

      router.replace('/dashboard');
    }

    syncAndRefresh();
  }, [searchParams, user, refreshProfile, router]);

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
  // Fetches once when the user is ready; the cleanup function prevents stale responses.
  const summaryFetchedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !user?.id) return;
    // Reset on each mount so navigating away and back refetches
    summaryFetchedRef.current = false;
    let cancelled = false;
    authFetch('/api/dashboard/summary?months=6&categoryPeriod=thisMonth')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data) {
          setSummaryData(data);
          summaryFetchedRef.current = true;
        }
      })
      .catch(err => {
        if (!cancelled) console.error('[dashboard] summary fetch error:', err);
      });
    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  // Fetch budgets at dashboard level so we can hide the card when empty
  useEffect(() => {
    if (authLoading || !user?.id) return;
    let cancelled = false;
    setBudgetsLoading(true);
    authFetch('/api/budgets')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        setBudgets(json?.data || []);
      })
      .catch((err) => {
        if (!cancelled) console.error('[dashboard] budgets fetch error:', err);
      })
      .finally(() => {
        if (!cancelled) setBudgetsLoading(false);
      });
    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  const hasBudgets = budgets.length > 0;

  // Components that receive pre-fetched summary data from the dashboard
  const summaryDataMap = {
    'SpendingVsEarningCard': summaryData?.spendingEarning,
    'TopCategoriesCard': summaryData?.spendingByCategory,
  };

  // Components that receive additional pre-fetched props
  const extraPropsMap = {
    'BudgetsCard': { budgets, loading: budgetsLoading },
  };

  // Items that should be hidden based on current state
  const isItemHidden = (component) => {
    if (component === 'BudgetsCard' && !budgetsLoading && !hasBudgets) return true;
    return false;
  };

  // Helper to render a single item (or row of items)
  const renderItem = (item) => {
    if (item.type === 'row') {
      const visibleItems = item.items.filter((sub) => !isItemHidden(sub.component));
      if (visibleItems.length === 0) return null;
      return (
        <div
          key={item.id}
          className={item.className || `flex flex-col lg:flex-row gap-8 ${item.height || ''}`}
        >
          {visibleItems.map((subItem) => {
            const Component = componentMap[subItem.component];
            if (!Component) return null;
            const extraProps = {
              ...(summaryDataMap[subItem.component] ? { data: summaryDataMap[subItem.component] } : {}),
              ...(extraPropsMap[subItem.component] || {}),
            };
            return (
              <div
                key={subItem.id}
                className={`${subItem.width || 'flex-1'} min-w-0 ${subItem.mobileHeight || ''}`}
              >
                <Component {...(subItem.props || {})} {...extraProps} />
              </div>
            );
          })}
        </div>
      );
    }

    if (isItemHidden(item.component)) return null;

    const Component = componentMap[item.component];
    if (!Component) return null;
    const extraProps = {
      ...(summaryDataMap[item.component] ? { data: summaryDataMap[item.component] } : {}),
      ...(extraPropsMap[item.component] || {}),
    };

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
          {dashboardLayout.main.map((item) => (
            <div key={item.id}>
              {renderItem(item)}
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-8">
          {!isPro && <UpgradeBanner />}
          {dashboardLayout.sidebar.map((item) => {
            // Hide pro-only cards (budgets, calendar) for free users
            if (!isPro && item.id === 'sidebar-group') return null;
            return (
              <div key={item.id}>
                {renderItem(item)}
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
