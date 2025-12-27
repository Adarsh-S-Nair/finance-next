"use client";

import { usePathname, useRouter } from "next/navigation";
import { LuChevronRight, LuSettings } from "react-icons/lu";
import PageContainer from "../../../components/PageContainer";
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
    onSettingsClick: null,
  });

  // Extract portfolio ID from pathname if we're on a detail page
  const portfolioId = pathname?.match(/\/investments\/([^/]+)/)?.[1];
  const isDetailPage = !!portfolioId;

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
      <PageContainer>
        {/* Persistent Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm">
            {isDetailPage ? (
              <>
                <button
                  onClick={() => router.push('/investments')}
                  className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
                >
                  Portfolios
                </button>
                <LuChevronRight className="w-3.5 h-3.5 text-[var(--color-border)]" />
                {portfolioName ? (
                  <span className="text-[var(--color-fg)] font-medium">{portfolioName}</span>
                ) : (
                  <span className="text-[var(--color-muted)]">Loading...</span>
                )}
              </>
            ) : (
              <h1 className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase" style={{ fontFamily: 'var(--font-poppins)' }}>
                Investments
              </h1>
            )}
          </div>
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
        </div>

        {/* Content */}
        {children}
      </PageContainer>
    </InvestmentsHeaderContext.Provider>
  );
}
