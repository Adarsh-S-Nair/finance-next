"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "../../../components/layout/PageContainer";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { PiBankFill } from "react-icons/pi";
import { FiTrash2 } from "react-icons/fi"; // Kept for error state icon
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import NetWorthCard from "../../../components/dashboard/NetWorthCard";
import { AssetsCard, LiabilitiesCard } from "../../../components/dashboard/AccountsSummaryCard";
import { NetWorthHoverProvider } from "../../../components/dashboard/NetWorthHoverContext";
import SegmentedTabs from "../../../components/ui/SegmentedTabs";
import PlaidLinkModal from "../../../components/PlaidLinkModal";
import UpgradeOverlay from "../../../components/UpgradeOverlay";

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Helper to capitalize words
const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Component for rendering account rows within the unified list
const AccountRow = ({ account, institutionMap, showDivider }) => {
  const institution = institutionMap[account.institutionId] || { name: 'Unknown', logo: null };

  return (
    <div
      className={`
        group flex items-center justify-between px-5 py-3.5
        hover:bg-[var(--color-card-highlight)] transition-all duration-200
        rounded-lg
      `}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        {/* Institution Logo */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-[var(--color-surface)]/50 border border-[var(--color-border)]/50">
          {institution.logo ? (
            <img
              src={institution.logo}
              alt={institution.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div className={`w-full h-full flex items-center justify-center ${institution.logo ? 'hidden' : 'flex'}`}>
            <PiBankFill className="w-4 h-4 text-[var(--color-muted)]" />
          </div>
        </div>

        {/* Account Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--color-fg)] text-sm mb-0.5">{account.name}</div>
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

      {/* Balance */}
      <div className="text-right ml-4">
        <div className="font-semibold text-[var(--color-fg)] tabular-nums text-sm">
          {formatCurrency(account.balance)}
        </div>
      </div>
    </div>
  );
};

// Component for category section headers within the unified list
const CategoryHeader = ({ title, count, total, isFirst }) => {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider opacity-80">
          {title}
        </h3>
      </div>
      <div className="text-xs font-semibold text-[var(--color-muted)] tabular-nums">
        {formatCurrency(total)}
      </div>
    </div>
  );
};

export default function AccountsPage() {
  const router = useRouter();
  const { profile, isPro } = useUser();
  const {
    accounts, // Institutions
    allAccounts, // Flat list of accounts
    loading,
    initialized,
    error,
    refreshAccounts
  } = useAccounts();

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleConnectAccount = () => {
    if (!isPro && accounts && accounts.length >= 1) {
      setIsUpgradeModalOpen(true);
    } else {
      setShowLinkModal(true);
    }
  };

  // Redirect new users to setup page
  useEffect(() => {
    if (initialized && !loading && allAccounts.length === 0 && !error) {
      router.replace("/setup");
    }
  }, [initialized, loading, allAccounts, error, router]);

  // Mobile tab state for the Assets / Liabilities summary toggle
  const [summaryTab, setSummaryTab] = useState('assets');

  // Organize accounts by category
  // Note: account.type in the transformed data is actually account.subtype || account.type
  // So we need to check for investment-related subtypes in the type field
  const categorizeAccount = (account) => {
    // In AccountsProvider, type is set to: account.subtype || account.type
    // So we need to check for both the original type values and subtype values
    const type = (account.type || '').toLowerCase();

    // Check for investment accounts (brokerage, stock plan, IRA, 401k, etc.)
    const investmentSubtypes = [
      'brokerage', 'stock plan', 'ira', '401k', '403b', '529', 
      'roth', 'sep', 'simple', 'keogh', 'pension', 'retirement',
      'investment' // Also check for the original type value
    ];
    if (investmentSubtypes.some(subtype => type.includes(subtype))) {
      return 'investments';
    }
    
    // Check for credit accounts
    if (type.includes('credit') || type === 'credit card') {
      return 'credit';
    }
    
    // Check for loan accounts
    const loanTypes = ['loan', 'mortgage', 'student', 'auto', 'home equity'];
    if (loanTypes.some(loanType => type.includes(loanType))) {
      return 'loans';
    }
    
    // Default to cash for depository accounts (checking, savings, etc.) and others
    return 'cash';
  };

  const categorizedAccounts = {
    cash: [],
    investments: [],
    credit: [],
    loans: []
  };

  if (allAccounts) {
    allAccounts.forEach(account => {
      const category = categorizeAccount(account);
      categorizedAccounts[category].push(account);
    });
  }

  const institutionMap = {};
  if (accounts) {
    accounts.forEach(inst => {
      institutionMap[inst.id] = inst;
    });
  }

  if (loading) {
    return (
      <PageContainer title="Accounts">
        <div className="space-y-10 animate-pulse">
          {/* Summary skeleton */}
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-2/3">
              <div className="h-4 bg-[var(--color-border)] rounded w-24 mb-4" />
              <div className="h-8 bg-[var(--color-border)] rounded w-40 mb-2" />
              <div className="h-3 bg-[var(--color-border)] rounded w-20 mb-6" />
              <div className="bg-[var(--color-border)] opacity-30 rounded-lg h-[180px]" />
            </div>
            <div className="lg:w-1/3 flex flex-col gap-8">
              <div>
                <div className="h-3 bg-[var(--color-border)] rounded w-12 mb-4" />
                <div className="h-6 bg-[var(--color-border)] rounded w-28 mb-4" />
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-4 bg-[var(--color-border)] rounded w-24" />
                      <div className="h-4 bg-[var(--color-border)] rounded w-16" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="h-3 bg-[var(--color-border)] rounded w-16 mb-4" />
                <div className="h-6 bg-[var(--color-border)] rounded w-28 mb-4" />
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-4 bg-[var(--color-border)] rounded w-24" />
                      <div className="h-4 bg-[var(--color-border)] rounded w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Accounts list skeleton */}
          <div className="pt-4">
            <div className="mb-6 px-1 flex items-end justify-between">
              <div className="h-5 bg-[var(--color-border)] rounded w-28" />
              <div className="h-8 bg-[var(--color-border)] rounded-full w-24" />
            </div>
            <div className="space-y-1">
              <div className="h-4 bg-[var(--color-border)] rounded w-32 mx-5 mb-2" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-border)]" />
                    <div>
                      <div className="h-4 bg-[var(--color-border)] rounded w-32 mb-1.5" />
                      <div className="h-3 bg-[var(--color-border)] rounded w-40" />
                    </div>
                  </div>
                  <div className="h-4 bg-[var(--color-border)] rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Accounts">
        <div className="text-center py-32">
          <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-danger),transparent_90%)] rounded-full flex items-center justify-center mb-4">
            <FiTrash2 className="h-8 w-8 text-[var(--color-danger)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Error loading accounts</h3>
          <p className="text-[var(--color-muted)] mb-6">{error}</p>
          <Button onClick={refreshAccounts}>Try Again</Button>
        </div>
      </PageContainer>
    );
  }

  const hasAccounts = allAccounts.length > 0;

  // When the user truly has zero accounts, some upstream page pushes them
  // to /setup. While that handoff is in flight (or if we're on this page
  // for any reason with no accounts), show a spinner rather than a blank
  // white screen — the latter looks like a broken page and causes support
  // tickets saying "accounts disappeared."
  if (!hasAccounts && !error && !loading) {
    return (
      <PageContainer title="Accounts">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
        </div>
      </PageContainer>
    );
  }

  return (
    <NetWorthHoverProvider>
      <PageContainer title="Accounts">
        <div className="space-y-10">
          {hasAccounts ? (
            <>
              {/* Summary Section */}
              <div className="w-full">
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="lg:w-2/3">
                    <NetWorthCard width="full" />
                  </div>
                  <div className="lg:w-1/3 flex flex-col gap-6 lg:gap-10">
                    {/* Mobile: tabbed toggle between Assets / Liabilities */}
                    <div className="flex justify-start lg:hidden">
                      <SegmentedTabs
                        size="xs"
                        value={summaryTab}
                        onChange={(v) => setSummaryTab(v)}
                        options={[
                          { label: 'Assets', value: 'assets' },
                          { label: 'Liabilities', value: 'liabilities' },
                        ]}
                      />
                    </div>

                    {/* Mobile: only the selected card; Desktop: both stacked */}
                    <div className={`${summaryTab === 'assets' ? 'block' : 'hidden'} lg:block`}>
                      <AssetsCard width="full" />
                    </div>
                    <div className={`${summaryTab === 'liabilities' ? 'block' : 'hidden'} lg:block`}>
                      <LiabilitiesCard width="full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounts List Section */}
              <div className="pt-4">
                <div className="mb-6 px-1">
                  <h2 className="text-lg font-medium text-[var(--color-fg)]">All Accounts</h2>
                </div>

                {/* Unified Accounts List */}
                <div className="overflow-hidden">
                  {/* Cash & Checking Section */}
                  {categorizedAccounts.cash.length > 0 && (
                    <>
                      <CategoryHeader
                        title="Cash & Checking"
                        count={categorizedAccounts.cash.length}
                        total={categorizedAccounts.cash.reduce((sum, acc) => sum + acc.balance, 0)}
                        isFirst={true}
                      />
                      {categorizedAccounts.cash.map((account, index) => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          institutionMap={institutionMap}
                          showDivider={index !== categorizedAccounts.cash.length - 1 ||
                            categorizedAccounts.investments.length > 0 ||
                            categorizedAccounts.credit.length > 0 ||
                            categorizedAccounts.loans.length > 0}
                        />
                      ))}
                    </>
                  )}

                  {/* Investments Section */}
                  {categorizedAccounts.investments.length > 0 && (
                    <>
                      <CategoryHeader
                        title="Investments"
                        count={categorizedAccounts.investments.length}
                        total={categorizedAccounts.investments.reduce((sum, acc) => sum + acc.balance, 0)}
                        isFirst={categorizedAccounts.cash.length === 0}
                      />
                      {categorizedAccounts.investments.map((account, index) => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          institutionMap={institutionMap}
                          showDivider={index !== categorizedAccounts.investments.length - 1 ||
                            categorizedAccounts.credit.length > 0 ||
                            categorizedAccounts.loans.length > 0}
                        />
                      ))}
                    </>
                  )}

                  {/* Credit Cards Section */}
                  {categorizedAccounts.credit.length > 0 && (
                    <>
                      <CategoryHeader
                        title="Credit Cards"
                        count={categorizedAccounts.credit.length}
                        total={categorizedAccounts.credit.reduce((sum, acc) => sum + acc.balance, 0)}
                        isFirst={categorizedAccounts.cash.length === 0 && categorizedAccounts.investments.length === 0}
                      />
                      {categorizedAccounts.credit.map((account, index) => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          institutionMap={institutionMap}
                          showDivider={index !== categorizedAccounts.credit.length - 1 ||
                            categorizedAccounts.loans.length > 0}
                        />
                      ))}
                    </>
                  )}

                  {/* Loans & Mortgages Section */}
                  {categorizedAccounts.loans.length > 0 && (
                    <>
                      <CategoryHeader
                        title="Loans & Mortgages"
                        count={categorizedAccounts.loans.length}
                        total={categorizedAccounts.loans.reduce((sum, acc) => sum + acc.balance, 0)}
                        isFirst={categorizedAccounts.cash.length === 0 &&
                          categorizedAccounts.investments.length === 0 &&
                          categorizedAccounts.credit.length === 0}
                      />
                      {categorizedAccounts.loans.map((account, index) => (
                        <AccountRow
                          key={account.id}
                          account={account}
                          institutionMap={institutionMap}
                          showDivider={index !== categorizedAccounts.loans.length - 1}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-24 bg-[var(--color-surface)]/30 rounded-2xl border border-[var(--color-border)]/50 border-dashed">
              <div className="mx-auto w-20 h-20 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--color-border)]">
                <PiBankFill className="h-10 w-10 text-[var(--color-muted)]" />
              </div>
              <h3 className="text-xl font-medium text-[var(--color-fg)] mb-2">No accounts connected</h3>
              <p className="text-[var(--color-muted)] mb-8 max-w-md mx-auto">
                Connect your bank accounts to see your net worth, track spending, and manage your finances in one place.
              </p>
              <Button size="lg" onClick={handleConnectAccount}>
                Connect Your First Account
              </Button>
            </div>
          )}
        </div>

        <PlaidLinkModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          onUpgradeNeeded={() => {
            setShowLinkModal(false);
            setIsUpgradeModalOpen(true);
          }}
        />
        <UpgradeOverlay
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
        />
      </PageContainer>
    </NetWorthHoverProvider>
  );
}
