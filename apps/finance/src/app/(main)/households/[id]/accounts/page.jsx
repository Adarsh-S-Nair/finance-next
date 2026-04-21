"use client";

import React, { useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { PiBankFill } from "react-icons/pi";
import PageContainer from "../../../../../components/layout/PageContainer";
import NetWorthCard from "../../../../../components/dashboard/NetWorthCard";
import {
  AssetsCard,
  LiabilitiesCard,
} from "../../../../../components/dashboard/AccountsSummaryCard";
import { Drawer, SegmentedTabs, Tooltip } from "@zervo/ui";
import { NetWorthHoverProvider } from "../../../../../components/dashboard/NetWorthHoverContext";
import { useUser } from "../../../../../components/providers/UserProvider";
import { useAccounts } from "../../../../../components/providers/AccountsProvider";
import { useHouseholdMeta } from "../../../../../components/providers/HouseholdDataProvider";
import HouseholdMemberFilter from "../../../../../components/households/HouseholdMemberFilter";
import AccountDetails from "../../../../../components/accounts/AccountDetails";
import { formatAccountSubtype } from "../../../../../lib/accountSubtype";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

function ownerName(owner) {
  if (!owner) return "Member";
  const parts = [owner.first_name, owner.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return owner.email || "Member";
}

function ownerInitials(owner) {
  if (!owner) return "?";
  const f = owner.first_name?.[0];
  const l = owner.last_name?.[0];
  if (f && l) return `${f}${l}`.toUpperCase();
  if (f) return f.toUpperCase();
  if (owner.email) return owner.email[0].toUpperCase();
  return "?";
}

/**
 * Small avatar badge — used both as a corner overlay on the institution
 * logo in each account row, and as a clickable chip in the member filter
 * at the top of the page.
 */
function MemberAvatar({ owner, size = "sm", muted = false }) {
  const dim = size === "lg" ? "h-9 w-9 text-xs" : size === "md" ? "h-6 w-6 text-[10px]" : "h-[18px] w-[18px] text-[9px]";
  return (
    <span
      className={clsx(
        "flex items-center justify-center overflow-hidden rounded-full font-semibold flex-shrink-0 transition-opacity",
        dim,
        muted ? "opacity-35" : "opacity-100",
        "bg-[var(--color-accent)] text-[var(--color-on-accent,white)]",
      )}
    >
      {owner?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={owner.avatar_url} alt={ownerName(owner)} className="h-full w-full object-cover" />
      ) : (
        <span>{ownerInitials(owner)}</span>
      )}
    </span>
  );
}

function InstitutionLogo({ institution }) {
  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
        {institution?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={institution.logo}
            alt={institution.name || ""}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
              if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div className={`w-full h-full flex items-center justify-center ${institution?.logo ? "hidden" : "flex"}`}>
          <PiBankFill className="w-4 h-4 text-[var(--color-muted)]" />
        </div>
      </div>
    </div>
  );
}

function AccountRow({ account, institutionMap, owner, onClick }) {
  const institution = institutionMap[account.institutionId] || { name: "Unknown", logo: null };
  return (
    <div
      onClick={() => onClick?.(account)}
      className="group flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-surface-alt)]/60 transition-colors rounded-lg cursor-pointer"
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="relative">
          <InstitutionLogo institution={institution} />
          {owner && (
            <Tooltip content={ownerName(owner)} side="top">
              <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--color-content-bg)]">
                <MemberAvatar owner={owner} size="sm" />
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--color-fg)] text-sm mb-0.5 truncate">
            {account.name}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
            {account.type && (
              <span className="truncate max-w-[180px]">{formatAccountSubtype(account.type)}</span>
            )}
            {account.type && account.mask && (
              <span className="text-[var(--color-border)]">•</span>
            )}
            {account.mask && <span className="font-mono">•••• {account.mask}</span>}
          </div>
        </div>
      </div>
      <div className="text-right ml-4">
        <div className="font-medium text-[var(--color-muted)] tabular-nums text-sm">
          {formatCurrency(account.balance)}
        </div>
      </div>
    </div>
  );
}

function CategoryHeader({ title }) {
  return (
    <div className="flex items-center px-5 py-3">
      <h3 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider opacity-80">
        {title}
      </h3>
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
  const { user } = useUser();
  const router = useRouter();
  const { accounts, allAccounts, loading, initialized, error } = useAccounts();
  const { memberByUserId, excludedMemberIds } = useHouseholdMeta();
  const [summaryTab, setSummaryTab] = useState("assets");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);

  const handleAccountClick = (account) => {
    setSelectedAccount(account);
    setIsAccountDrawerOpen(true);
  };

  const titleNode = "Accounts";

  const institutionMap = {};
  (accounts || []).forEach((inst) => {
    institutionMap[inst.id] = inst;
  });

  const categorized = { cash: [], investments: [], credit: [], loans: [] };
  for (const a of allAccounts || []) categorized[categorizeAccount(a)].push(a);

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
        <HouseholdMemberFilter />
        <div className="space-y-10">
          <div className="text-center py-24">
            <div className="mx-auto w-20 h-20 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--color-border)]">
              <PiBankFill className="h-10 w-10 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-xl font-medium text-[var(--color-fg)] mb-2">
              {excludedMemberIds.size > 0
                ? "No accounts for the selected members"
                : "No accounts in this household yet"}
            </h3>
            <p className="text-[var(--color-muted)] max-w-md mx-auto">
              {excludedMemberIds.size > 0
                ? "Adjust the filter above to see accounts from other members."
                : "Once members connect accounts, they'll show up here combined across everyone."}
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <NetWorthHoverProvider>
      <PageContainer title={titleNode}>
        <HouseholdMemberFilter />
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
                  <CategoryHeader title="Cash" />
                  {categorized.cash.map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      institutionMap={institutionMap}
                      owner={memberByUserId.get(a.userId)}
                      onClick={handleAccountClick}
                    />
                  ))}
                </>
              )}
              {categorized.investments.length > 0 && (
                <>
                  <CategoryHeader title="Investments" />
                  {categorized.investments.map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      institutionMap={institutionMap}
                      owner={memberByUserId.get(a.userId)}
                      onClick={handleAccountClick}
                    />
                  ))}
                </>
              )}
              {categorized.credit.length > 0 && (
                <>
                  <CategoryHeader title="Credit Cards" />
                  {categorized.credit.map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      institutionMap={institutionMap}
                      owner={memberByUserId.get(a.userId)}
                      onClick={handleAccountClick}
                    />
                  ))}
                </>
              )}
              {categorized.loans.length > 0 && (
                <>
                  <CategoryHeader title="Loans & Mortgages" />
                  {categorized.loans.map((a) => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      institutionMap={institutionMap}
                      owner={memberByUserId.get(a.userId)}
                      onClick={handleAccountClick}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        <Drawer
          isOpen={isAccountDrawerOpen}
          onClose={() => setIsAccountDrawerOpen(false)}
          title="Account Details"
          size="md"
        >
          <AccountDetails
            account={selectedAccount}
            institution={selectedAccount ? institutionMap[selectedAccount.institutionId] : null}
            onViewTransactions={
              selectedAccount && user?.id && selectedAccount.userId === user.id
                ? () => {
                    setIsAccountDrawerOpen(false);
                    router.push(`/transactions?accountId=${selectedAccount.id}`);
                  }
                : undefined
            }
          />
        </Drawer>
      </PageContainer>
    </NetWorthHoverProvider>
  );
}
