"use client";

import React, { useState } from "react";
import Card from "../ui/Card";
import Pill from "../ui/Pill";
import { useAccounts } from "../AccountsProvider";

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper function to categorize accounts
function categorizeAccount(account) {
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
}

// Segmented bar component with proper color differentiation
function SegmentedBar({ segments, total, label, className = "", displayMode, onToggleMode }) {
  if (total === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
          <span className="text-sm text-[var(--color-muted)]">{formatCurrency(0)}</span>
        </div>
        <div className="w-full h-2 bg-[var(--color-border)] rounded-full">
          <div className="h-full bg-[var(--color-muted)]/20 rounded-full flex items-center justify-center">
            <span className="text-xs text-[var(--color-muted)]">No data</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          {formatCurrency(total)}
        </span>
      </div>
      
      {/* Segmented bar with distinct colors */}
      <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden relative">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            {/* Different colors for different segment types */}
            <linearGradient id="cashGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="investmentsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="1" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="creditGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="loansGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {/* Render segments with proper positioning and colors */}
          {segments.map((segment, index) => {
            const percentage = (segment.amount / total) * 100;
            const leftOffset = segments.slice(0, index).reduce((sum, s) => sum + (s.amount / total) * 100, 0);
            
            // Determine gradient based on segment label
            let gradientId = 'cashGradient';
            if (segment.label === 'Investments') gradientId = 'investmentsGradient';
            else if (segment.label === 'Credit') gradientId = 'creditGradient';
            else if (segment.label === 'Loans') gradientId = 'loansGradient';
            
            return (
              <rect
                key={index}
                x={`${leftOffset}%`}
                y="0"
                width={`${percentage}%`}
                height="100%"
                fill={`url(#${gradientId})`}
                rx="0"
                ry="0"
              />
            );
          })}
          
          {/* Separator lines between segments */}
          {segments.length > 1 && segments[0].amount > 0 && (
            <line
              x1={`${(segments[0].amount / total) * 100}%`}
              y1="0"
              x2={`${(segments[0].amount / total) * 100}%`}
              y2="100%"
              stroke="var(--color-bg)"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>
      
      {/* Compact legend with clickable amounts */}
      <div className="flex justify-between text-xs">
        {segments.map((segment, index) => {
          const percentage = (segment.amount / total) * 100;
          
          // Determine color based on segment type
          let dotColor = '#3b82f6'; // Default to cash color
          
          if (segment.label === 'Investments') {
            dotColor = '#8b5cf6';
          } else if (segment.label === 'Credit') {
            dotColor = '#f59e0b';
          } else if (segment.label === 'Loans') {
            dotColor = '#ef4444';
          }
          
          return (
            <div key={index} className="flex items-center gap-1.5">
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ 
                  backgroundColor: dotColor
                }}
              />
              <span className="text-[var(--color-muted)] text-xs">
                {segment.label}:
              </span>
              <Pill 
                variant="toggle" 
                size="sm" 
                onClick={onToggleMode}
                className="text-xs px-2 py-1 font-mono"
              >
                {displayMode === 'percentage' 
                  ? `${percentage.toFixed(0)}%` 
                  : formatCurrency(segment.amount)
                }
              </Pill>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Overall assets vs liabilities comparison bar
function OverallComparisonBar({ totalAssets, totalLiabilities, displayMode, onToggleMode, className = "" }) {
  const netWorth = totalAssets - totalLiabilities;
  const totalNetWorth = totalAssets + totalLiabilities;
  
  if (totalNetWorth === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--color-fg)]">Net Worth</span>
          <span className="text-sm text-[var(--color-muted)]">{formatCurrency(0)}</span>
        </div>
        <div className="w-full h-2 bg-[var(--color-border)] rounded-full">
          <div className="h-full bg-[var(--color-muted)]/20 rounded-full flex items-center justify-center">
            <span className="text-xs text-[var(--color-muted)]">No data</span>
          </div>
        </div>
      </div>
    );
  }

  const assetsPercentage = (totalAssets / totalNetWorth) * 100;
  const liabilitiesPercentage = (totalLiabilities / totalNetWorth) * 100;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">Net Worth</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          {formatCurrency(netWorth)}
        </span>
      </div>
      
      {/* Overall comparison bar */}
      <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden relative">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <linearGradient id="assetsOverallGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="liabilitiesOverallGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {/* Assets segment */}
          <rect
            x="0"
            y="0"
            width={`${assetsPercentage}%`}
            height="100%"
            fill="url(#assetsOverallGradient)"
            rx="0"
            ry="0"
          />
          
          {/* Liabilities segment */}
          <rect
            x={`${assetsPercentage}%`}
            y="0"
            width={`${liabilitiesPercentage}%`}
            height="100%"
            fill="url(#liabilitiesOverallGradient)"
            rx="0"
            ry="0"
          />
          
          {/* Separator line */}
          {totalAssets > 0 && totalLiabilities > 0 && (
            <line
              x1={`${assetsPercentage}%`}
              y1="0"
              x2={`${assetsPercentage}%`}
              y2="100%"
              stroke="var(--color-bg)"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>
      
      {/* Compact legend with clickable amounts */}
      <div className="flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[var(--color-muted)] text-xs">Assets:</span>
          <Pill 
            variant="toggle" 
            size="sm" 
            onClick={onToggleMode}
            className="text-xs px-2 py-1 font-mono"
          >
            {displayMode === 'percentage' 
              ? `${assetsPercentage.toFixed(0)}%` 
              : formatCurrency(totalAssets)
            }
          </Pill>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[var(--color-muted)] text-xs">Liabilities:</span>
          <Pill 
            variant="toggle" 
            size="sm" 
            onClick={onToggleMode}
            className="text-xs px-2 py-1 font-mono"
          >
            {displayMode === 'percentage' 
              ? `${liabilitiesPercentage.toFixed(0)}%` 
              : formatCurrency(totalLiabilities)
            }
          </Pill>
        </div>
      </div>
    </div>
  );
}

export default function AccountsSummaryCard() {
  const { allAccounts, loading } = useAccounts();
  const [displayMode, setDisplayMode] = useState('currency'); // 'currency' or 'percentage'

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'currency' ? 'percentage' : 'currency');
  };

  if (loading) {
    return (
      <Card width="1/3" className="animate-pulse">
        <div className="mb-4">
          <div className="h-4 bg-[var(--color-border)] rounded w-24 mb-1" />
          <div className="h-3 bg-[var(--color-border)] rounded w-16" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-3 bg-[var(--color-border)] rounded w-full" />
            <div className="h-3 bg-[var(--color-border)] rounded w-3/4" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-[var(--color-border)] rounded w-full" />
            <div className="h-3 bg-[var(--color-border)] rounded w-2/3" />
          </div>
        </div>
      </Card>
    );
  }

  // Categorize accounts
  const categorizedAccounts = allAccounts.reduce((acc, account) => {
    const category = categorizeAccount(account);
    const amount = Math.abs(account.balance);
    
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += amount;
    
    return acc;
  }, {});

  // Prepare data for segmented bars
  const assetsData = {
    cash: categorizedAccounts.cash || 0,
    investments: categorizedAccounts.investments || 0,
  };

  const liabilitiesData = {
    credit: categorizedAccounts.credit || 0,
    loans: categorizedAccounts.loans || 0,
  };

  const totalAssets = assetsData.cash + assetsData.investments;
  const totalLiabilities = liabilitiesData.credit + liabilitiesData.loans;

  // Create segments for assets
  const assetSegments = [
    { label: 'Cash', amount: assetsData.cash },
    { label: 'Investments', amount: assetsData.investments },
  ].filter(segment => segment.amount > 0);

  // Create segments for liabilities
  const liabilitySegments = [
    { label: 'Credit', amount: liabilitiesData.credit },
    { label: 'Loans', amount: liabilitiesData.loans },
  ].filter(segment => segment.amount > 0);

  return (
    <Card width="1/3">
      <div className="mb-4">
        <div className="text-sm text-[var(--color-muted)]">Accounts Summary</div>
      </div>
      
      <div className="space-y-4">
        <OverallComparisonBar
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          displayMode={displayMode}
          onToggleMode={toggleDisplayMode}
        />
        
        <SegmentedBar
          segments={assetSegments}
          total={totalAssets}
          label="Assets"
          displayMode={displayMode}
          onToggleMode={toggleDisplayMode}
        />
        
        <SegmentedBar
          segments={liabilitySegments}
          total={totalLiabilities}
          label="Liabilities"
          displayMode={displayMode}
          onToggleMode={toggleDisplayMode}
        />
      </div>
    </Card>
  );
}
