"use client";

import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import { FaPlus } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import { PiBankFill } from "react-icons/pi";
import { FiDollarSign, FiCreditCard, FiTrendingUp, FiFileText, FiPieChart, FiTrendingUp as FiAssets, FiTrendingDown, FiBriefcase, FiDollarSign as FiMoney, FiMinusCircle } from "react-icons/fi";
import { IoMdCash } from "react-icons/io";
import { FaCoins, FaCreditCard } from "react-icons/fa";
import { TiChartArea } from "react-icons/ti";
import { useState } from "react";
import { useUser } from "../../components/UserProvider";
import { useAccounts } from "../../components/AccountsProvider";
import { getAccentTextColor, getAccentTextColorWithOpacity, getAccentIconColor } from "../../lib/colorUtils";
import PlaidLinkModal from "../../components/PlaidLinkModal";

export default function AccountsPage() {
  const { profile } = useUser();
  const { 
    accounts, 
    allAccounts, 
    loading, 
    error, 
    totalBalance, 
    totalAssets, 
    totalLiabilities, 
    refreshAccounts 
  } = useAccounts();
  
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const isDefaultAccent = !profile?.accent_color;
  
  const [isPlaidModalOpen, setIsPlaidModalOpen] = useState(false);

  const handleAddAccount = () => {
    setIsPlaidModalOpen(true);
  };

  const handleRefresh = () => {
    refreshAccounts();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const capitalizeWords = (str) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };


  const getTotalBalance = (institutionAccounts) => {
    return institutionAccounts.reduce((sum, account) => sum + account.balance, 0);
  };
  
  // Mock data for chart indicators (in a real app, this would come from historical data)
  const netWorthChange = 5.2; // 5.2% increase
  const assetsChange = 3.8; // 3.8% increase
  const liabilitiesChange = -2.1; // 2.1% decrease (good)

  // Show loading state
  if (loading) {
    return (
      <PageContainer 
        title="Accounts"
        action={
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              variant="ghost"
              size="icon"
              aria-label="Refresh Accounts"
              disabled={loading}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              onClick={handleAddAccount}
              variant="ghost"
              size="icon"
              aria-label="Add Account"
            >
              <FaPlus className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
            <p className="text-[var(--color-muted)]">Loading accounts...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Show error state
  if (error) {
    return (
      <PageContainer 
        title="Accounts"
        action={
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              variant="ghost"
              size="icon"
              aria-label="Refresh Accounts"
              disabled={loading}
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              onClick={handleAddAccount}
              variant="ghost"
              size="icon"
              aria-label="Add Account"
            >
              <FaPlus className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <FiMinusCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Error loading accounts</h3>
          <p className="text-[var(--color-muted)] mb-4">{error}</p>
          <Button onClick={refreshAccounts}>
            Try Again
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer 
      title="Accounts"
      action={
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleRefresh}
            variant="ghost"
            size="icon"
            aria-label="Refresh Accounts"
            disabled={loading}
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            onClick={handleAddAccount}
            variant="ghost"
            size="icon"
            aria-label="Add Account"
          >
            <FaPlus className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Show empty state if no accounts */}
        {allAccounts.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              <PiBankFill className="h-8 w-8 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">No accounts connected</h3>
            <p className="text-[var(--color-muted)] mb-4">Connect your bank accounts to start tracking your finances</p>
            <Button onClick={handleAddAccount}>
              Connect Bank Account
            </Button>
          </div>
        ) : (
          <>
            {/* Financial Overview Cards - only show if we have accounts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Net Worth Card */}
              <div className={`rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[color-mix(in_oklab,var(--color-accent),var(--color-fg)_20%)] p-4 ${getAccentTextColor(isDarkMode, isDefaultAccent)}`}>
                <div className="flex items-center gap-4">
                  <TiChartArea className={`h-8 w-8 ${getAccentIconColor(isDarkMode, isDefaultAccent)} opacity-90`} />
                  <div>
                    <div className={`text-sm ${getAccentTextColorWithOpacity(isDarkMode, isDefaultAccent, 0.8)}`}>Net Worth</div>
                    <div className="text-xl font-normal">
                      {formatCurrency(totalBalance)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Assets Card */}
              <div className="rounded-lg bg-[var(--color-surface)] p-4">
                <div className="flex items-center gap-4">
                  <FaCoins className="h-8 w-8 text-[var(--color-muted)]" />
                  <div>
                    <div className="text-sm text-[var(--color-muted)]">Assets</div>
                    <div className="text-xl font-normal text-[var(--color-fg)]">
                      {formatCurrency(totalAssets)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Liabilities Card */}
              <div className="rounded-lg bg-[var(--color-surface)] p-4">
                <div className="flex items-center gap-4">
                  <FaCreditCard className="h-8 w-8 text-[var(--color-muted)]" />
                  <div>
                    <div className="text-sm text-[var(--color-muted)]">Liabilities</div>
                    <div className="text-xl font-normal text-[var(--color-fg)]">
                      {formatCurrency(totalLiabilities)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Institution Cards - only show if we have accounts */}
            {accounts.map((institution) => (
              <div key={institution.id} className="rounded-md bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden">
                      {institution.logo ? (
                        <img 
                          src={institution.logo} 
                          alt={`${institution.name} logo`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <PiBankFill 
                        className={`h-4 w-4 ${getAccentIconColor(isDarkMode, isDefaultAccent)} ${institution.logo ? 'hidden' : 'block'}`}
                      />
                    </div>
                    <div>
                      <div className="font-medium">{institution.name}</div>
                      <div className="text-sm text-[var(--color-muted)]">
                        {institution.accounts.length} account{institution.accounts.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-normal text-[var(--color-fg)]">
                      {formatCurrency(getTotalBalance(institution.accounts))}
                    </div>
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">
                      Total Balance
                    </div>
                  </div>
                </div>
              
                {institution.accounts.length === 0 ? (
                  <div className="text-center py-8 text-[var(--color-muted)]">
                    <p>No accounts yet</p>
                  </div>
                ) : (
                  <div className="space-y-0 pl-4">
                    {institution.accounts.map((account, index) => (
                      <div key={account.id} className={index < institution.accounts.length - 1 ? "border-b border-[var(--color-border)] pb-3 mb-3" : ""}>
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <div className="font-medium text-[var(--color-fg)]">{account.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-[var(--color-muted)]">
                                {capitalizeWords(account.type)}
                              </span>
                              {account.mask && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                                  •••• {account.mask}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-normal text-[var(--color-fg)]">
                              {formatCurrency(account.balance)}
                            </div>
                            {account.limit && (
                              <div className="text-xs text-[var(--color-muted)]">
                                of {formatCurrency(account.limit)} limit
                              </div>
                            )}
                            {account.monthlyPayment && (
                              <div className="text-xs text-[var(--color-muted)]">
                                ${account.monthlyPayment}/mo
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
      
      {/* Plaid Link Modal */}
      <PlaidLinkModal 
        isOpen={isPlaidModalOpen}
        onClose={() => setIsPlaidModalOpen(false)}
      />
    </PageContainer>
  );
}
