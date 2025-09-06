"use client";

import PageContainer from "../../components/PageContainer";
import Button from "../../components/ui/Button";
import { FaPlus } from "react-icons/fa";
import { PiBankFill } from "react-icons/pi";
import { FiDollarSign, FiCreditCard, FiTrendingUp, FiFileText, FiPieChart, FiTrendingUp as FiAssets, FiTrendingDown, FiBriefcase, FiDollarSign as FiMoney, FiMinusCircle } from "react-icons/fi";
import { IoMdCash } from "react-icons/io";
import { useState } from "react";
import { useUser } from "../../components/UserProvider";

export default function AccountsPage() {
  const { profile } = useUser();
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const isDefaultAccent = !profile?.accent_color;
  
  const [accounts, setAccounts] = useState({
    cash: [
      {
        id: 1,
        name: "Checking Account",
        type: "checking",
        balance: 2543.67,
        bank: "Chase Bank"
      },
      {
        id: 2,
        name: "Savings Account", 
        type: "savings",
        balance: 12500.00,
        bank: "Chase Bank"
      }
    ],
    credit: [
      {
        id: 3,
        name: "Chase Freedom",
        type: "credit",
        balance: -1250.50,
        bank: "Chase Bank",
        limit: 5000
      }
    ],
    investments: [
      {
        id: 4,
        name: "401(k) Retirement",
        type: "investment",
        balance: 45000.00,
        bank: "Fidelity"
      }
    ],
    loans: [
      {
        id: 5,
        name: "Auto Loan",
        type: "loan",
        balance: -18500.00,
        bank: "Chase Bank",
        monthlyPayment: 350
      }
    ]
  });

  const handleAddAccount = () => {
    // TODO: Implement add account functionality
    console.log("Add account clicked");
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };


  const getSectionTitle = (section) => {
    switch (section) {
      case 'cash':
        return 'Cash Accounts';
      case 'credit':
        return 'Credit Cards';
      case 'investments':
        return 'Investments';
      case 'loans':
        return 'Loans';
      default:
        return 'Accounts';
    }
  };

  const getSectionIcon = (section) => {
    switch (section) {
      case 'cash':
        return IoMdCash;
      case 'credit':
        return FiCreditCard;
      case 'investments':
        return FiTrendingUp;
      case 'loans':
        return FiFileText;
      default:
        return PiBankFill;
    }
  };

  const getTotalBalance = (sectionAccounts) => {
    return sectionAccounts.reduce((sum, account) => sum + account.balance, 0);
  };

  const allAccounts = [...accounts.cash, ...accounts.credit, ...accounts.investments, ...accounts.loans];
  const totalBalance = allAccounts.reduce((sum, account) => sum + account.balance, 0);
  
  // Calculate assets (positive balances)
  const assets = allAccounts.filter(account => account.balance > 0);
  const totalAssets = assets.reduce((sum, account) => sum + account.balance, 0);
  
  // Calculate liabilities (negative balances)
  const liabilities = allAccounts.filter(account => account.balance < 0);
  const totalLiabilities = Math.abs(liabilities.reduce((sum, account) => sum + account.balance, 0));

  return (
    <PageContainer 
      title="Accounts"
      action={
        <Button 
          onClick={handleAddAccount}
          variant="ghost"
          size="icon"
          aria-label="Add Account"
        >
          <FaPlus className="h-4 w-4" />
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Financial Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Net Worth Card */}
          <div className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[color-mix(in_oklab,var(--color-accent),var(--color-fg)_20%)] p-4 text-[var(--color-on-accent)]">
            <div className="flex items-center gap-4">
              <FiBriefcase className="h-8 w-8 opacity-90" />
              <div>
                <div className="text-sm opacity-80">Net Worth</div>
                <div className="text-xl font-normal">
                  {formatCurrency(totalBalance)}
                </div>
              </div>
            </div>
          </div>
          
          {/* Assets Card */}
          <div className="rounded-lg bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-4">
              <FiMoney className="h-8 w-8 text-[var(--color-muted)]" />
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
              <FiMinusCircle className="h-8 w-8 text-[var(--color-muted)]" />
              <div>
                <div className="text-sm text-[var(--color-muted)]">Liabilities</div>
                <div className="text-xl font-normal text-[var(--color-fg)]">
                  {formatCurrency(totalLiabilities)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Type Cards */}
        {Object.entries(accounts).map(([sectionKey, sectionAccounts]) => {
          const SectionIcon = getSectionIcon(sectionKey);
          return (
            <div key={sectionKey} className="rounded-md bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] mb-3">
                <div className="flex items-center gap-3">
                  <SectionIcon 
                    className="h-5 w-5 text-[var(--color-muted)]" 
                  />
                  <div className="font-medium">{getSectionTitle(sectionKey)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-normal text-[var(--color-fg)]">
                    {formatCurrency(getTotalBalance(sectionAccounts))}
                  </div>
                </div>
              </div>
            
            {sectionAccounts.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-muted)]">
                <p>No {getSectionTitle(sectionKey).toLowerCase()} yet</p>
              </div>
            ) : (
              <div className="space-y-0 pl-4">
                {sectionAccounts.map((account, index) => (
                  <div key={account.id} className={index < sectionAccounts.length - 1 ? "border-b border-[var(--color-border)] pb-3 mb-3" : ""}>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                          <PiBankFill 
                            className={`h-4 w-4 ${
                              isDarkMode && isDefaultAccent 
                                ? "text-black" 
                                : "text-[var(--color-on-accent)]"
                            }`} 
                          />
                        </div>
                        <div>
                          <div className="font-medium text-[var(--color-fg)]">{account.name}</div>
                          <div className="text-sm text-[var(--color-muted)]">{account.bank}</div>
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
          );
        })}

        {/* Empty State */}
        {allAccounts.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              <FaPlus className="h-8 w-8 text-[var(--color-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">No accounts yet</h3>
            <p className="text-[var(--color-muted)] mb-4">Get started by adding your first account</p>
            <Button onClick={handleAddAccount}>
              <FaPlus className="h-4 w-4 mr-2" />
              Add Your First Account
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
