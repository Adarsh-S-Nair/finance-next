"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import { authFetch } from "../../../lib/api/fetch";
import { supabase } from "../../../lib/supabase/client";
import PageContainer from "../../../components/layout/PageContainer";
import SpendingVsEarningCard from "../../../components/dashboard/SpendingVsEarningCard.jsx";
import { dashboardLayout } from "../../../config/dashboardLayout";
import MonthlyOverviewCard from "../../../components/dashboard/MonthlyOverviewCard";
import TopHoldingsCard from "../../../components/dashboard/TopHoldingsCard";
import BudgetsCard from "../../../components/dashboard/BudgetsCard";
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
  const fetchSummary = useCallback(async () => {
    try {
      const res = await authFetch('/api/dashboard/summary?months=6&categoryPeriod=thisMonth');
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setSummaryData(data);
        summaryFetchedRef.current = true;
      }
    } catch (err) {
      console.error('[dashboard] summary fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    summaryFetchedRef.current = false;
    fetchSummary();
  }, [authLoading, user?.id, fetchSummary]);

  // Realtime: refetch dashboard summary whenever plaid_items changes for
  // this user — catches the post-FTUX case where the dashboard renders
  // with an empty summary (no transactions yet) and transactions land a
  // few seconds later via webhook. Debounced so burst writes collapse
  // into one refetch.
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
            fetchSummary();
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
  }, [user?.id, fetchSummary]);

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
            className="mt-6 inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-alt)]"
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

        {/* Sidebar — fixed width, anchored to the right */}
        <div className="lg:w-[320px] xl:w-[360px] lg:flex-shrink-0 space-y-6 lg:space-y-10">
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
