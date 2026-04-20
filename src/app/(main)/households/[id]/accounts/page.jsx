"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PiBankFill } from "react-icons/pi";
import PageContainer from "../../../../../components/layout/PageContainer";
import NetWorthCard from "../../../../../components/dashboard/NetWorthCard";
import {
  AssetsCard,
  LiabilitiesCard,
} from "../../../../../components/dashboard/AccountsSummaryCard";
import { NetWorthHoverProvider } from "../../../../../components/dashboard/NetWorthHoverContext";
import SegmentedTabs from "../../../../../components/ui/SegmentedTabs";
import { useAccounts } from "../../../../../components/providers/AccountsProvider";
import { authFetch } from "../../../../../lib/api/fetch";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

function AccountRow({ account, institutionMap }) {
  const institution = institutionMap[account.institutionId] || { name: "Unknown", logo: null };
  return (
    <div className="group flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-card-highlight)] transition-all duration-200 rounded-lg">
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
          {institution.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={institution.logo}
              alt={institution.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div className={`w-full h-full flex items-center justify-center ${institution.logo ? "hidden" : "flex"}`}>
            <PiBankFill className="w-4 h-4 text-[var(--color-muted)]" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--color-fg)] text-sm mb-0.5 truncate">
            {account.name}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            <span className="truncate max-w-[180px]">{institution.name}</span>
            {account.mask && (
              <>
                <span className="text-[var(--color-border)]">•</span>
                <span className="font-mono">•••• {account.mask}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right ml-4">
        <div className="font-semibold text-[var(--color-fg)] tabular-nums text-sm">
          {formatCurrency(account.balance)}
        </div>
      </div>
    </div>
  );
}

function CategoryHeader({ title, total }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <h3 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider opacity-80">
        {title}
      </h3>
      <div className="text-xs font-semibold text-[var(--color-muted)] tabular-nums">
        {formatCurrency(total)}
      </div>
    </div>
  );
}

function categorizeAccount(account) {
  const type = (account.type || "").toLowerCase();
  const investment = [
    "brokerage", "stock plan", "ira", "401k", "403b", "529",
    "roth", "sep", "simple", "keogh", "pension", "retirement", "investment",
  ];
  if (investment.some((k) => type.includes(k))) return "investments";
  if (type.includes("credit") || type === "credit card") return "credit";
  const loans = ["loan", "mortgage", "student", "auto", "home equity"];
  if (loans.some((k) => type.includes(k))) return "loans";
  return "cash";
}

export default function HouseholdAccountsPage() {
  const params = useParams();
  const householdId = typeof params?.id === "string" ? params.id : null;

  const { accounts, allAccounts, loading, initialized, error } = useAccounts();

  const [household, setHousehold] = useState(null);

  const loadHousehold = useCallback(async () => {
    if (!householdId) return;
    try {
      const res = await authFetch(`/api/households/${householdId}`);
      if (!res.ok) return;
      const data = await res.json();
      setHousehold(data.household);
    } catch (err) {
      console.error("[household] load error", err);
    }
  }, [householdId]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  const [summaryTab, setSummaryTab] = useState("assets");

  const institutionMap = {};
  (accounts || []).forEach((inst) => {
    institutionMap[inst.id] = inst;
  });

  const categorized = { cash: [], investments: [], credit: [], loans: [] };
  for (const a of allAccounts || []) categorized[categorizeAccount(a)].push(a);

  const titleNode = (
    <div className="flex items-center gap-3 min-w-0">
      {household && (
        <span
          className="block h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: household.color }}
          aria-hidden
        />
      )}
      <span className="truncate">Accounts</span>
      {household && (
        <span className="text-xs font-normal text-[var(--color-muted)] hidden sm:inline truncate">
          · {household.name}
        </span>
      )}
    </div>
  );

  if (loading || !initialized) {
    return (
      <PageContainer title={titleNode}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title={titleNode}>
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </PageContainer>
    );
  }

  const hasAccounts = (allAccounts?.length ?? 0) > 0;

  if (!hasAccounts) {
    return (
      <PageContainer title={titleNode}>
        <div className="text-center py-24">
          <div className="mx-auto w-20 h-20 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--color-border)]">
            <PiBankFill className="h-10 w-10 text-[var(--color-muted)]" />
          </div>
          <h3 className="text-xl font-medium text-[var(--color-fg)] mb-2">
            No accounts in this household yet
          </h3>
          <p className="text-[var(--color-muted)] max-w-md mx-auto">
            Once members connect accounts, they&apos;ll show up here combined across everyone.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <NetWorthHoverProvider>
      <PageContainer title={titleNode}>
        <div className="space-y-10">
          <div className="w-full">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3">
                <NetWorthCard width="full" />
              </div>
              <div className="lg:w-1/3 flex flex-col gap-6 lg:gap-10">
                <div className="flex justify-start lg:hidden">
                  <SegmentedTabs
                    size="xs"
                    value={summaryTab}
                    onChange={(v) => setSummaryTab(v)}
                    options={[
                      { label: "Assets", value: "assets" },
                      { label: "Liabilities", value: "liabilities" },
                    ]}
                  />
                </div>
                <div className={`${summaryTab === "assets" ? "block" : "hidden"} lg:block`}>
                  <AssetsCard width="full" />
                </div>
                <div className={`${summaryTab === "liabilities" ? "block" : "hidden"} lg:block`}>
                  <LiabilitiesCard width="full" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <div className="mb-6 px-1">
              <h2 className="text-lg font-medium text-[var(--color-fg)]">All Accounts</h2>
            </div>

            <div className="overflow-hidden">
              {categorized.cash.length > 0 && (
                <>
                  <CategoryHeader
                    title="Cash & Checking"
                    total={categorized.cash.reduce((s, a) => s + a.balance, 0)}
                  />
                  {categorized.cash.map((a) => (
                    <AccountRow key={a.id} account={a} institutionMap={institutionMap} />
                  ))}
                </>
              )}
              {categorized.investments.length > 0 && (
                <>
                  <CategoryHeader
                    title="Investments"
                    total={categorized.investments.reduce((s, a) => s + a.balance, 0)}
                  />
                  {categorized.investments.map((a) => (
                    <AccountRow key={a.id} account={a} institutionMap={institutionMap} />
                  ))}
                </>
              )}
              {categorized.credit.length > 0 && (
                <>
                  <CategoryHeader
                    title="Credit Cards"
                    total={categorized.credit.reduce((s, a) => s + a.balance, 0)}
                  />
                  {categorized.credit.map((a) => (
                    <AccountRow key={a.id} account={a} institutionMap={institutionMap} />
                  ))}
                </>
              )}
              {categorized.loans.length > 0 && (
                <>
                  <CategoryHeader
                    title="Loans & Mortgages"
                    total={categorized.loans.reduce((s, a) => s + a.balance, 0)}
                  />
                  {categorized.loans.map((a) => (
                    <AccountRow key={a.id} account={a} institutionMap={institutionMap} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </NetWorthHoverProvider>
  );
}
