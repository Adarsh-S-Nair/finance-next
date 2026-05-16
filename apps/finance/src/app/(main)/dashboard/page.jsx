"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { authFetch } from "../../../lib/api/fetch";
import { useAuthedQuery } from "../../../lib/api/useAuthedQuery";
import { supabase } from "../../../lib/supabase/client";
import PageContainer from "../../../components/layout/PageContainer";
import SpendingVsEarningCard from "../../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../../config/dashboardLayout";
import MonthlyOverviewCard from "../../../components/dashboard/MonthlyOverviewCard";
import TopHoldingsCard from "../../../components/dashboard/TopHoldingsCard";
import BudgetsCard from "../../../components/dashboard/BudgetsCard";
import GoalsCard from "../../../components/dashboard/GoalsCard";
import TopCategoriesCard from "../../../components/dashboard/TopCategoriesCard";
import CalendarCard from "../../../components/dashboard/CalendarCard";
import NetWorthBanner from "../../../components/dashboard/NetWorthBanner";
import InsightsCarousel from "../../../components/dashboard/InsightsCarousel";
import { capitalizeFirstOnly } from "../../../lib/utils/formatName";
import UpgradeBanner from "../../../components/dashboard/UpgradeBanner";

// Map string keys to actual components
const componentMap = {
  'MonthlyOverviewCard': MonthlyOverviewCard,
  'SpendingVsEarningCard': SpendingVsEarningCard,
  'TopHoldingsCard': TopHoldingsCard,
  'BudgetsCard': BudgetsCard,
  'GoalsCard': GoalsCard,
  'TopCategoriesCard': TopCategoriesCard,
  'CalendarCard': CalendarCard,
  'NetWorthBanner': NetWorthBanner,
  'InsightsCarousel': InsightsCarousel,
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isPro, loading: authLoading, refreshProfile } = useUser();
  const {
    accounts,
    loading: accountsLoading,
    initialized: accountsInitialized,
    error: accountsError,
    refreshAccounts,
  } = useAccounts();
  const queryClient = useQueryClient();
  const [greeting, setGreeting] = useState("Dashboard");

  // Dashboard summary — single batched endpoint that feeds the
  // SpendingVsEarning and TopCategories cards. Lives in react-query
  // so returning to /dashboard after navigating away shows the cached
  // data instantly (stale-while-revalidate) instead of flashing
  // skeletons every time. Realtime updates below invalidate this key.
  const {
    data: summaryData,
  } = useAuthedQuery(
    ["dashboard-summary", user?.id],
    user?.id ? "/api/dashboard/summary?months=6&categoryPeriod=thisMonth" : null,
  );

  // Budgets — fed into BudgetsCard + used to decide whether the card
  // even renders. Same caching rationale as the summary above.
  const {
    data: budgetsPayload,
    isLoading: budgetsLoading,
  } = useAuthedQuery(
    ["dashboard-budgets", user?.id],
    user?.id ? "/api/budgets" : null,
  );
  const budgets = budgetsPayload?.data ?? [];

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

  // Realtime: invalidate the cached summary whenever plaid_items
  // changes for this user — catches the post-FTUX case where the
  // dashboard renders with an empty summary (no transactions yet)
  // and transactions land a few seconds later via webhook. Debounced
  // so burst writes collapse into one refetch. react-query handles
  // the actual refetch via invalidateQueries.
  const summaryDebounceRef = useRef(null);
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dashboard-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plaid_items',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (summaryDebounceRef.current) clearTimeout(summaryDebounceRef.current);
          summaryDebounceRef.current = setTimeout(() => {
            summaryDebounceRef.current = null;
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary', user.id] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-budgets', user.id] });
          }, 800);
        }
      )
      .subscribe();
    return () => {
      if (summaryDebounceRef.current) {
        clearTimeout(summaryDebounceRef.current);
        summaryDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

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
          className={item.className || `flex flex-col lg:flex-row gap-10 ${item.height || ''}`}
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

  // Only bounce to /setup when we know for a fact the user has no
  // accounts. An errored fetch (500, network failure) must NOT trigger
  // a redirect — that used to make transient outages look like brand-new
  // users and wipe them into the onboarding flow.
  useEffect(() => {
    if (
      accountsInitialized &&
      !accountsLoading &&
      !accountsError &&
      !hasInstitutions
    ) {
      router.replace("/setup");
    }
  }, [accountsInitialized, accountsLoading, accountsError, hasInstitutions, router]);

  // Surface a real error state instead of silently rendering an empty
  // dashboard when the accounts fetch failed.
  if (accountsError) {
    return (
      <PageContainer title="Dashboard">
        <div className="mx-auto max-w-md py-24 text-center">
          <h2 className="text-lg font-medium text-[var(--color-fg)]">
            We couldn&apos;t load your accounts
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{accountsError}</p>
          <button
            type="button"
            onClick={() => refreshAccounts(true)}
            className="mt-6 inline-flex items-center gap-1 rounded-full ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-fg)] px-5 h-9 text-sm text-[var(--color-fg)] transition-[box-shadow,color]"
          >
            Try again
          </button>
        </div>
      </PageContainer>
    );
  }

  // While we're actively redirecting to /setup (user has zero accounts),
  // render a spinner instead of a blank white page so the handoff feels
  // intentional.
  if (accountsInitialized && !accountsLoading && !hasInstitutions) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
      </div>
    );
  }

  return (
    <PageContainer title={greeting} documentTitle="Dashboard">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {/* Main Content Area — flexes to fill available width */}
        <div className="flex-1 min-w-0 space-y-6 lg:space-y-10">
          {dashboardLayout.main.map((item) => (
            <div key={item.id}>
              {renderItem(item)}
            </div>
          ))}
        </div>

        {/* Sidebar — fixed width, anchored to the right.
            Insights render first so the user-specific signal is the
            top thing they see; the Pro upgrade pitch sits below it. */}
        <div className="lg:w-[320px] xl:w-[360px] lg:flex-shrink-0 space-y-6 lg:space-y-10">
          {dashboardLayout.sidebar.map((item) => {
            // Hide pro-only cards (budgets, calendar) for free users
            if (!isPro && item.id === 'sidebar-group') return null;
            return (
              <Fragment key={item.id}>
                <div>{renderItem(item)}</div>
                {/* Slot the upgrade banner as a sibling immediately
                    after insights so the parent's space-y-* applies. */}
                {!isPro && item.id === 'insights' && <UpgradeBanner />}
              </Fragment>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
