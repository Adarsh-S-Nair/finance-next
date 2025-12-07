"use client";

import React, { useState, useRef } from "react";
import PageContainer from "../../../components/PageContainer";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { PiBankFill, PiPlus } from "react-icons/pi";
import { FiTrash2 } from "react-icons/fi"; // Kept for error state icon
import { useUser } from "../../../components/UserProvider";
import { useAccounts } from "../../../components/AccountsProvider";
import NetWorthCard from "../../../components/dashboard/NetWorthCard";
import { AssetsCard, LiabilitiesCard } from "../../../components/dashboard/AccountsSummaryCard";
import { NetWorthHoverProvider } from "../../../components/dashboard/NetWorthHoverContext";
import PlaidLinkModal from "../../../components/PlaidLinkModal";

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
  const { profile } = useUser();
  const {
    accounts, // Institutions
    allAccounts, // Flat list of accounts
    loading,
    error,
    refreshAccounts
  } = useAccounts();

  const [showLinkModal, setShowLinkModal] = useState(false);

  // Mobile carousel state
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const scrollContainerRef = useRef(null);

  // Organize accounts by category
  const categorizeAccount = (account) => {
    const fullType = `${account.type || ''} ${account.subtype || ''}`.toLowerCase();
    const liabilityTypes = ['credit card', 'credit', 'loan', 'mortgage', 'line of credit', 'overdraft'];
    const isLiability = liabilityTypes.some(t => fullType.includes(t));

    if (isLiability) {
      if (fullType.includes('credit') && !fullType.includes('line of credit')) return 'credit';
      return 'loans';
    } else {
      if (fullType.includes('investment') || fullType.includes('brokerage') || fullType.includes('ira') || fullType.includes('401k')) return 'investments';
      return 'cash';
    }
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
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto mb-4" />
            <p className="text-[var(--color-muted)]">Loading accounts...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Accounts">
        <div className="text-center py-32">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <FiTrash2 className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Error loading accounts</h3>
          <p className="text-[var(--color-muted)] mb-6">{error}</p>
          <Button onClick={refreshAccounts}>Try Again</Button>
        </div>
      </PageContainer>
    );
  }

  const hasAccounts = allAccounts.length > 0;

  return (
    <NetWorthHoverProvider>
      <PageContainer title="Accounts">
        <div className="space-y-8">
          {hasAccounts ? (
            <>
              {/* Summary Section */}
              <div className="w-full">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="lg:w-2/3">
                    <NetWorthCard width="full" />
                  </div>
                  <div className="lg:w-1/3 flex flex-col gap-4">
                    {/* Mobile Carousel Container */}
                    <div
                      ref={scrollContainerRef}
                      className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none] lg:block lg:space-y-6 lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 scroll-smooth"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      onScroll={(e) => {
                        const { scrollLeft, offsetWidth } = e.currentTarget;
                        const index = Math.round(scrollLeft / offsetWidth);
                        setActiveCardIndex(index);
                      }}
                    >
                      <div className="min-w-full snap-center lg:min-w-0 pr-4 lg:pr-0 last:pr-0">
                        <AssetsCard width="full" />
                      </div>
                      <div className="min-w-full snap-center lg:min-w-0">
                        <LiabilitiesCard width="full" />
                      </div>
                    </div>

                    {/* Pagination Dots (Mobile Only) */}
                    <div className="flex justify-center gap-2 lg:hidden">
                      <div
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeCardIndex === 0 ? 'bg-[var(--color-fg)] w-4' : 'bg-[var(--color-border)]'}`}
                      />
                      <div
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeCardIndex === 1 ? 'bg-[var(--color-fg)] w-4' : 'bg-[var(--color-border)]'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounts List Section */}
              <div className="pt-4">
                <div className="mb-6 px-1 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-[var(--color-fg)]">All Accounts</h2>
                  </div>
                  <Button
                    size="sm"
                    variant="matte"
                    onClick={() => setShowLinkModal(true)}
                    className="gap-1.5 !rounded-full pl-3 pr-4"
                  >
                    <PiPlus className="w-3.5 h-3.5" />
                    Connect
                  </Button>
                </div>

                {/* Unified Accounts Card */}
                <Card padding="none" variant="glass" className="overflow-hidden !bg-transparent border-0 shadow-none hover:shadow-none backdrop-blur-none">
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
                </Card>
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
              <Button size="lg" onClick={() => setShowLinkModal(true)}>
                Connect Your First Account
              </Button>
            </div>
          )}
        </div>

        <PlaidLinkModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
        />
      </PageContainer>
    </NetWorthHoverProvider>
  );
}
