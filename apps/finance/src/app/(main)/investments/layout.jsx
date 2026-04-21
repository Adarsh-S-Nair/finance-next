"use client";

import { usePathname, useRouter } from "next/navigation";
import { LuChevronRight, LuRefreshCw } from "react-icons/lu";
import PageContainer from "../../../components/layout/PageContainer";
import PageHeader from "../../../components/layout/PageHeader";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useUser } from "../../../components/providers/UserProvider";
import { InvestmentsHeaderContext } from "./InvestmentsHeaderContext";
import { Button } from "@zervo/ui";

export default function InvestmentsLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [accountName, setAccountName] = useState(null);
  const [headerActions, setHeaderActions] = useState({
    onSyncHoldingsClick: null,
    isSyncingHoldings: false,
  });

  // Detail pages are /investments/<account_id>
  const accountIdMatch = pathname?.match(/\/investments\/([^/]+)/)?.[1];
  const accountId = accountIdMatch || null;
  const isDetailPage = !!accountId;

  // Fetch account name for detail pages
  useEffect(() => {
    if (!accountId || !user?.id) {
      setAccountName(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("accounts")
          .select("name")
          .eq("id", accountId)
          .eq("user_id", user.id)
          .single();
        if (error) throw error;
        if (!cancelled) setAccountName(data?.name || null);
      } catch (err) {
        console.error("Error fetching account name:", err);
        if (!cancelled) setAccountName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, user?.id]);

  return (
    <InvestmentsHeaderContext.Provider value={{ setHeaderActions }}>
      <PageContainer showHeader={false}>
        <PageHeader
          title={isDetailPage ? (accountName || "Loading...") : "Investments"}
          prefix={
            isDetailPage ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/investments")}
                  className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
                >
                  Investments
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
                  title="Refresh holdings"
                  aria-label="Refresh holdings"
                >
                  <LuRefreshCw className={`w-3.5 h-3.5 ${headerActions.isSyncingHoldings ? "animate-spin" : ""}`} />
                </Button>
              )}
            </div>
          }
        />
        {children}
      </PageContainer>
    </InvestmentsHeaderContext.Provider>
  );
}
