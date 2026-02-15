"use client";

import { usePathname, useRouter } from "next/navigation";
import { LuChevronRight, LuSettings } from "react-icons/lu";
import PageContainer from "../../../components/PageContainer";
import PageHeader from "../../../components/PageHeader";
import Button from "../../../components/ui/Button";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useUser } from "../../../components/UserProvider";
import { LuPlus } from "react-icons/lu";
import { PaperTradingHeaderContext } from "./PaperTradingHeaderContext";

export default function PaperTradingLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useUser();
  const [portfolioName, setPortfolioName] = useState(null);
  const [headerActions, setHeaderActions] = useState({
    onCreateClick: null,
    onSettingsClick: null,
  });

  // Extract portfolio ID from pathname if we're on a detail page
  // Handle both /paper-trading/[portfolio_id] and /paper-trading/arbitrage/[portfolio_id]
  // Exclude "backtest" and "arbitrage" from being treated as portfolio IDs
  const pathSegments = pathname?.split('/').filter(Boolean) || [];
  const paperTradingIdx = pathSegments.indexOf('paper-trading');

  let portfolioId = null;
  let isBacktestPage = false;
  let isArbitragePage = false;

  if (paperTradingIdx !== -1) {
    const nextSegment = pathSegments[paperTradingIdx + 1];

    if (nextSegment === 'backtest') {
      isBacktestPage = true;
    } else if (nextSegment === 'arbitrage') {
      isArbitragePage = true;
      // Portfolio ID is the segment after 'arbitrage'
      const arbitragePortfolioId = pathSegments[paperTradingIdx + 2];
      if (arbitragePortfolioId) {
        portfolioId = arbitragePortfolioId;
      }
    } else if (nextSegment && nextSegment !== 'paper-trading') {
      // Regular portfolio ID (UUID format)
      portfolioId = nextSegment;
    }
  }

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
    <PaperTradingHeaderContext.Provider value={{ setHeaderActions }}>
      <PageContainer showHeader={false}>
        <PageHeader
          title={
            isDetailPage
              ? (isBacktestPage ? "Backtest Results" : (portfolioName || "Loading..."))
              : "Paper Trading"
          }
          prefix={
            isDetailPage ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/paper-trading')}
                  className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
                >
                  Paper Trading
                </button>
                <LuChevronRight className="w-3.5 h-3.5 text-[var(--color-border)]" />
              </div>
            ) : null
          }
          action={
            <div className="flex items-center gap-2">
              {isDetailPage && headerActions.onSettingsClick && (
                <button
                  onClick={headerActions.onSettingsClick}
                  className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-all cursor-pointer"
                  title="Portfolio Settings"
                >
                  <LuSettings className="w-4 h-4" />
                </button>
              )}
              {!isDetailPage && headerActions.onCreateClick && (
                <Button
                  size="sm"
                  variant="matte"
                  onClick={headerActions.onCreateClick}
                  className="gap-1.5 !rounded-full pl-3 pr-4"
                >
                  <LuPlus className="w-3.5 h-3.5" />
                  New Portfolio
                </Button>
              )}
            </div>
          }
        />

        {/* Content */}
        {children}
      </PageContainer>
    </PaperTradingHeaderContext.Provider>
  );
}
