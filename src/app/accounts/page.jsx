"use client";

import React, { useState } from "react";
import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { PiBankFill, PiPlus } from "react-icons/pi";
import { FiTrash2 } from "react-icons/fi"; // Kept for error state icon
import { useUser } from "../../components/UserProvider";
import { useAccounts } from "../../components/AccountsProvider";
import NetWorthCard from "../../components/dashboard/NetWorthCard";
import AccountsSummaryCard from "../../components/dashboard/AccountsSummaryCard";
import { NetWorthHoverProvider } from "../../components/dashboard/NetWorthHoverContext";
import PlaidLinkModal from "../../components/PlaidLinkModal";

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

// Component for a section of accounts (e.g. Cash, Credit)
const AccountSection = ({ title, accounts, institutionMap }) => {
  if (!accounts || accounts.length === 0) return null;

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <div className="mb-8 last:mb-0">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 pl-4 pr-6">
        <h3 className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">
          {title} <span className="text-[var(--color-border)] mx-1">•</span> {accounts.length}
        </h3>
        <div className="text-sm font-medium text-[var(--color-muted)] text-right">
          {formatCurrency(totalBalance)}
        </div>
      </div>

      {/* Accounts List Card */}
      <Card padding="none" variant="glass" className="overflow-hidden">
        {accounts.map((account, index) => {
          const institution = institutionMap[account.institutionId] || { name: 'Unknown', logo: null };

          return (
            <div
              key={account.id}
              className={`
                group flex items-center justify-between pl-4 py-4 pr-6
                hover:bg-[var(--color-card-highlight)] transition-colors duration-200
                ${index !== accounts.length - 1 ? 'border-b border-[var(--color-border)]/50' : ''}
              `}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Institution Logo - Square with rounded corners for better fit */}
                <div className="w-8 h-8 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
                  {institution.logo ? (
                    <img
                      src={institution.logo}
                      alt={institution.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                  ) : null}
                  {/* Fallback icon */}
                  <PiBankFill className={`w-4 h-4 text-[var(--color-muted)] ${institution.logo ? 'hidden' : 'block'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[var(--color-fg)] truncate text-sm">{account.name}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] mt-0.5">
                    <span className="truncate max-w-[150px]">{institution.name}</span>
                    {account.mask && (
                      <>
                        <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-muted)]" />
                        <span className="font-mono text-[var(--color-muted)]">•••• {account.mask}</span>
                      </>
                    )}
                    <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-muted)]" />
                    <span>{capitalizeWords(account.subtype || account.type)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center pl-4">
                <div className="text-right">
                  <div className="font-medium text-[var(--color-fg)] tabular-nums text-sm">
                    {formatCurrency(account.balance)}
                  </div>
                  {(account.limit || account.monthlyPayment) && (
                    <div className="text-xs text-[var(--color-muted)] mt-0.5 tabular-nums">
                      {account.limit ? `Limit: ${formatCurrency(account.limit)}` :
                        account.monthlyPayment ? `$${account.monthlyPayment}/mo` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
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
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-2/3">
                  <NetWorthCard width="full" />
                </div>
                <div className="lg:w-1/3">
                  <AccountsSummaryCard width="full" />
                </div>
              </div>

              {/* Accounts List Section */}
              <div className="max-w-5xl mx-auto pt-4">
                <div className="mb-6 px-1 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-fg)]">All Accounts</h2>
                    <p className="text-sm text-[var(--color-muted)] mt-1">Manage your connected bank accounts and cards</p>
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

                <div className="space-y-1">
                  <AccountSection
                    title="Cash & Checking"
                    accounts={categorizedAccounts.cash}
                    institutionMap={institutionMap}
                  />

                  <AccountSection
                    title="Investments"
                    accounts={categorizedAccounts.investments}
                    institutionMap={institutionMap}
                  />

                  <AccountSection
                    title="Credit Cards"
                    accounts={categorizedAccounts.credit}
                    institutionMap={institutionMap}
                  />

                  <AccountSection
                    title="Loans & Mortgages"
                    accounts={categorizedAccounts.loans}
                    institutionMap={institutionMap}
                  />
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
