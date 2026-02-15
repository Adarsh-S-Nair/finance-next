"use client";

import { usePathname, useRouter } from "next/navigation";
import { LuChevronRight, LuRefreshCw, LuSettings } from "react-icons/lu";
import PageContainer from "../../../components/PageContainer";
import PageHeader from "../../../components/PageHeader";
import Button from "../../../components/ui/Button";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useUser } from "../../../components/UserProvider";
import { LuPlus } from "react-icons/lu";
import { InvestmentsHeaderContext } from "./InvestmentsHeaderContext";

export default function InvestmentsLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useUser();
  const [portfolioName, setPortfolioName] = useState(null);
  const [headerActions, setHeaderActions] = useState({
    onConnectClick: null,
    onSyncHoldingsClick: null,
    isSyncingHoldings: false,
    onSettingsClick: null,
  });

  // Extract portfolio ID from pathname if we're on a detail page
  // Exclude "backtest" route from being treated as a portfolio ID
  const portfolioIdMatch = pathname?.match(/\/investments\/([^/]+)/)?.[1];
  const portfolioId = portfolioIdMatch && portfolioIdMatch !== 'backtest' ? portfolioIdMatch : null;
  const isBacktestPage = portfolioIdMatch === 'backtest';
  const isDetailPage = !!portfolioId || isBacktestPage;

  // Fetch portfolio name for detail pages
  useEffect(() => {
    if (!portfolioId || !profile?.id) {
      setPortfolioName(null);
      return;
    }

    const fetchPortfolioName = async () => {
      try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('name')
          .eq('id', portfolioId)
          .eq('user_id', profile.id)
          .single();

        if (error) throw error;
        setPortfolioName(data?.name || null);
      } catch (err) {
        console.error('Error fetching portfolio name:', err);
        setPortfolioName(null);
      }
    };

    fetchPortfolioName();
  }, [portfolioId, profile?.id]);

  return (
    <InvestmentsHeaderContext.Provider value={{ setHeaderActions }}>
      <PageContainer showHeader={false}>
        <PageHeader
          title={
            isDetailPage
              ? (isBacktestPage ? "Backtest Results" : (portfolioName || "Loading..."))
              : "Investments"
          }
          prefix={
            isDetailPage ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/investments')}
                  className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
                >
                  Portfolios
                </button>
                <LuChevronRight className="w-3.5 h-3.5 text-[var(--color-border)]" />
              </div>
            ) : null
          }
          action={
            <div className="flex items-center gap-2">
              {!isDetailPage && headerActions.onSyncHoldingsClick && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={headerActions.onSyncHoldingsClick}
                  disabled={headerActions.isSyncingHoldings}
                  className="!rounded-full !px-2"
                  title="Investment sync options"
                  aria-label="Investment sync options"
                >
                  <LuRefreshCw className={`w-3.5 h-3.5 ${headerActions.isSyncingHoldings ? 'animate-spin' : ''}`} />
                </Button>
              )}
              {isDetailPage && headerActions.onSettingsClick && (
                <button
                  onClick={headerActions.onSettingsClick}
                  className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-all cursor-pointer"
                  title="Portfolio Settings"
                >
                  <LuSettings className="w-4 h-4" />
                </button>
              )}
              {!isDetailPage && headerActions.onConnectClick && (
                <Button
                  size="sm"
                  variant="matte"
                  onClick={headerActions.onConnectClick}
                  className="gap-1.5 !rounded-full pl-3 pr-4"
                >
                  <LuPlus className="w-3.5 h-3.5" />
                  Connect
                </Button>
              )}
            </div>
          }
        />

        {/* Content */}
        {children}
      </PageContainer>
    </InvestmentsHeaderContext.Provider>
  );
}
