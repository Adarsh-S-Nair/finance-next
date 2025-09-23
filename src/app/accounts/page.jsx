"use client";

import React from "react";
import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { FaUnlink, FaCoins } from "react-icons/fa";
import { FaEllipsisVertical } from "react-icons/fa6";
import { PiBankFill } from "react-icons/pi";
import { FiDollarSign, FiCreditCard, FiTrendingUp, FiFileText, FiPieChart, FiTrendingUp as FiAssets, FiTrendingDown, FiBriefcase, FiDollarSign as FiMoney, FiMinusCircle, FiWallet, FiBarChart3, FiHome } from "react-icons/fi";
import { IoMdCash } from "react-icons/io";
import { TiChartArea } from "react-icons/ti";
import { useState } from "react";
import { useUser } from "../../components/UserProvider";
import { useAccounts } from "../../components/AccountsProvider";
import { getAccentTextColor, getAccentTextColorWithOpacity, getAccentIconColor } from "../../lib/colorUtils";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "../../components/ui/ContextMenu";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import NetWorthCard from "../../components/dashboard/NetWorthCard";
import AccountsSummaryCard from "../../components/dashboard/AccountsSummaryCard";
import { NetWorthHoverProvider } from "../../components/dashboard/NetWorthHoverContext";

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
  
  const [disconnectModal, setDisconnectModal] = useState({ isOpen: false, institution: null });
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnectInstitution = (institution) => {
    setDisconnectModal({ isOpen: true, institution });
  };

  const handleConfirmDisconnect = async () => {
    const { institution } = disconnectModal;
    
    if (!institution.plaidItemId) {
      alert('Unable to disconnect: Missing Plaid item information.');
      return;
    }

    try {
      setIsDisconnecting(true);
      console.log('Disconnecting institution:', institution.name, 'plaidItemId:', institution.plaidItemId);
      
      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plaidItemId: institution.plaidItemId,
          userId: profile?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to disconnect');
      }

      const result = await response.json();
      console.log('Disconnect successful:', result);
      
      // Refresh accounts to reflect the changes
      refreshAccounts();
      
      // Close the modal
      setDisconnectModal({ isOpen: false, institution: null });
      
    } catch (error) {
      console.error('Error disconnecting institution:', error);
      alert(`Failed to disconnect ${institution.name}: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCancelDisconnect = () => {
    setDisconnectModal({ isOpen: false, institution: null });
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
      <PageContainer title="Accounts">
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
      <PageContainer title="Accounts">
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
    <NetWorthHoverProvider>
      <PageContainer title="Accounts">
        <div className="space-y-6">
        {/* Show empty state if no accounts */}
        {allAccounts.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              <PiBankFill className="h-8 w-8 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">No accounts connected</h3>
              <p className="text-[var(--color-muted)] mb-4">Go to Settings to connect your bank accounts</p>
          </div>
        ) : (
          <>
              {/* Net Worth and Accounts Summary Cards */}
              <div className="flex flex-col lg:flex-row gap-6">
                <NetWorthCard />
                <AccountsSummaryCard />
                    </div>

              {/* Accounts by Category */}
              <div className="mt-8 space-y-6">
                {(() => {
                  // Helper function to categorize accounts (same logic as dashboard components)
                  const categorizeAccount = (account) => {
                    const accountType = (account.type || '').toLowerCase();
                    const accountSubtype = (account.subtype || '').toLowerCase();
                    const fullType = `${accountType} ${accountSubtype}`.trim();
                    
                    // Check if it's a liability first
                    const liabilityTypes = [
                      'credit card', 'credit', 'loan', 'mortgage', 
                      'line of credit', 'overdraft', 'other'
                    ];
                    
                    const isLiability = liabilityTypes.some(type => fullType.includes(type));
                    
                    if (isLiability) {
                      // Categorize liabilities
                      if (fullType.includes('credit card') || fullType.includes('credit')) {
                        return 'credit';
                      } else if (fullType.includes('loan') || fullType.includes('mortgage') || fullType.includes('line of credit')) {
                        return 'loans';
                      } else {
                        return 'credit'; // Default to credit for other liability types
                      }
                    } else {
                      // Categorize assets
                      if (fullType.includes('investment') || fullType.includes('brokerage') || 
                          fullType.includes('401k') || fullType.includes('ira') || 
                          fullType.includes('retirement') || fullType.includes('mutual fund') ||
                          fullType.includes('stock') || fullType.includes('bond')) {
                        return 'investments';
                      } else {
                        return 'cash'; // Default to cash for checking, savings, etc.
                      }
                    }
                  };

                  // Create institution lookup map
                  const institutionMap = {};
                  accounts.forEach(institution => {
                    institutionMap[institution.id] = {
                      name: institution.name,
                      logo: institution.logo
                    };
                  });

                  // Group all accounts by category
                  const categorizedAccounts = {
                    cash: [],
                    investments: [],
                    credit: [],
                    loans: []
                  };

                  allAccounts.forEach(account => {
                    const category = categorizeAccount(account);
                    categorizedAccounts[category].push(account);
                  });

                  // Category configurations
                  const categoryConfig = {
                    cash: {
                      title: 'Cash & Checking',
                      iconType: 'wallet',
                      color: 'blue',
                      description: 'Checking, savings, and cash accounts'
                    },
                    investments: {
                      title: 'Investments',
                      iconType: 'chart',
                      color: 'purple',
                      description: 'Investment and retirement accounts'
                    },
                    credit: {
                      title: 'Credit Cards',
                      iconType: 'credit',
                      color: 'orange',
                      description: 'Credit card accounts'
                    },
                    loans: {
                      title: 'Loans & Mortgages',
                      iconType: 'home',
                      color: 'red',
                      description: 'Loan and mortgage accounts'
                    }
                  };

                  // Helper function to render the correct icon
                  const renderIcon = (iconType) => {
                    switch (iconType) {
                      case 'wallet':
                        return <FiDollarSign className="h-5 w-5 text-[var(--color-accent)]" />;
                      case 'chart':
                        return <FiTrendingUp className="h-5 w-5 text-[var(--color-accent)]" />;
                      case 'credit':
                        return <FiCreditCard className="h-5 w-5 text-[var(--color-accent)]" />;
                      case 'home':
                        return <PiBankFill className="h-5 w-5 text-[var(--color-accent)]" />;
                      default:
                        return <PiBankFill className="h-5 w-5 text-[var(--color-accent)]" />;
                    }
                  };

                  return Object.entries(categoryConfig).map(([categoryKey, config]) => {
                    const accounts = categorizedAccounts[categoryKey];
                    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

                    return (
                      <Card key={categoryKey} width="full">
                        {/* Category Header */}
                        <div className="mb-4 pb-3 border-b border-[var(--color-border)]/30">
                          <div className="text-sm font-semibold text-[var(--color-fg)]">{config.title}</div>
                          <div className="text-xs text-[var(--color-muted)] mt-0.5">
                            {accounts.length} account{accounts.length !== 1 ? 's' : ''} • {formatCurrency(totalBalance)}
                          </div>
                        </div>
                        
                        {/* Accounts List */}
                        {accounts.length > 0 ? (
                          <div className="space-y-2">
                            {accounts.map((account) => {
                              // Find the institution for this account using institutionId
                              const institution = institutionMap[account.institutionId] || { 
                                name: 'Unknown Institution', 
                                logo: null 
                              };
                              
                              return (
                                <div key={account.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)]/50 last:border-b-0">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {/* Institution Logo */}
                                    <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                                        className={`h-3.5 w-3.5 text-[var(--color-accent)] ${institution.logo ? 'hidden' : 'block'}`}
                                      />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <div className="font-medium text-[var(--color-fg)] truncate text-sm">{account.name}</div>
                                        {account.mask && (
                                          <span className="font-mono text-xs text-[var(--color-muted)]">
                                            •••• {account.mask}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                                        <span>{institution.name}</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--color-muted)]/10 text-[var(--color-muted)]">
                                          {capitalizeWords(account.type)}
                                        </span>
                                      </div>
                                      
                                      {(account.limit || account.monthlyPayment) && (
                                        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mt-0.5">
                                          {account.limit && (
                                            <span>Limit: {formatCurrency(account.limit)}</span>
                                          )}
                                          {account.monthlyPayment && (
                                            <span>Payment: ${account.monthlyPayment}/mo</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="text-right flex-shrink-0 ml-3">
                                    <div className="text-sm font-semibold text-[var(--color-fg)]">
                                      {formatCurrency(account.balance)}
                                    </div>
                                    {account.balance < 0 && (
                                      <div className="text-xs text-red-500 mt-0.5">Credit balance</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-xs text-[var(--color-muted)]">No {config.title.toLowerCase()} accounts</p>
                          </div>
                        )}
                      </Card>
                    );
                  });
                })()}
              </div>
          </>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      <ConfirmDialog
        isOpen={disconnectModal.isOpen}
        onCancel={handleCancelDisconnect}
        onConfirm={handleConfirmDisconnect}
        title={`Disconnect ${disconnectModal.institution?.name}`}
        description={`Are you sure you want to disconnect ${disconnectModal.institution?.name}? This will remove all associated accounts and transaction data from your dashboard.`}
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDisconnecting}
        busyLabel="Disconnecting..."
      />
    </PageContainer>
    </NetWorthHoverProvider>
  );
}
