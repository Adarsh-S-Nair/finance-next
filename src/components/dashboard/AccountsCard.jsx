"use client";

import React from "react";
import Card from "../ui/Card";
import { useAccounts } from "../AccountsProvider";
import { useRouter } from "next/navigation";
import Button from "../ui/Button";
import { PiBankFill } from "react-icons/pi";

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AccountsCard() {
  const { accounts, allAccounts, loading } = useAccounts();
  const router = useRouter();

  const handleAddAccount = () => {
    // This would typically open the Plaid Link modal
    // For now, just navigate to accounts page
    router.push('/accounts');
  };

  if (loading) {
    return (
      <Card width="1/3" className="animate-pulse">
        <div className="mb-4">
          <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-1" />
          <div className="h-3 bg-[var(--color-border)] rounded w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-[var(--color-border)] rounded w-full" />
          <div className="h-3 bg-[var(--color-border)] rounded w-3/4" />
        </div>
      </Card>
    );
  }

  const totalAccounts = allAccounts.length;
  const totalInstitutions = accounts.length;

  return (
    <Card width="1/3">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-[var(--color-muted)]">Accounts</div>
        <button
          onClick={() => router.push('/accounts')}
          className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors"
        >
          View all
        </button>
      </div>
      
      {totalAccounts === 0 ? (
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] rounded-full flex items-center justify-center mb-4">
            <PiBankFill className="h-8 w-8 text-[var(--color-muted)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">No accounts connected</h3>
          <p className="text-sm text-[var(--color-muted)] mb-4">Connect your bank accounts to start tracking your finances</p>
          <Button 
            size="sm" 
            onClick={handleAddAccount}
            className="w-full"
          >
            Connect Account
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Account List */}
          <div className="space-y-1">
            {accounts.slice(0, 4).map((institution) => {
              const institutionTotal = institution.accounts.reduce((sum, account) => sum + account.balance, 0);
              return (
                <div key={institution.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-[var(--color-muted)]/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden flex-shrink-0">
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
                      className={`h-4 w-4 text-white ${institution.logo ? 'hidden' : 'block'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                      {institution.name}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {institution.accounts.length} account{institution.accounts.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium text-[var(--color-fg)]">
                      {formatCurrency(institutionTotal)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Placeholder rows to fill space */}
            {accounts.length < 4 && Array.from({ length: 4 - accounts.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="flex items-center gap-3 py-2 px-2 rounded-md opacity-30">
                <div className="w-8 h-8 rounded-full bg-[var(--color-muted)]/20 flex items-center justify-center flex-shrink-0">
                  <PiBankFill className="h-4 w-4 text-[var(--color-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-3 bg-[var(--color-muted)]/20 rounded w-20 mb-1"></div>
                  <div className="h-2 bg-[var(--color-muted)]/20 rounded w-12"></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="h-3 bg-[var(--color-muted)]/20 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
          
          {accounts.length > 4 && (
            <div className="text-xs text-[var(--color-muted)] text-center pt-2">
              +{accounts.length - 4} more institution{accounts.length - 4 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
