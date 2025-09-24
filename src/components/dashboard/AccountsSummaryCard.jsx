"use client";

import React, { useState, useEffect, useRef } from "react";
import Card from "../ui/Card";
import Pill from "../ui/Pill";
import { useAccounts } from "../AccountsProvider";
import { useNetWorthHover } from "./NetWorthHoverContext";

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 120 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef(null);

  useEffect(() => {
    if (displayValue === value) return;

    setIsAnimating(true);
    
    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeOutCubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, displayValue]);

  return (
    <span className={isAnimating ? 'transition-all duration-150' : ''}>
      {formatCurrency(displayValue)}
    </span>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

// Modern segmented bar component using accent color
function SegmentedBar({ segments, total, label, className = "", isAnimated = false }) {
  if (total === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
          <span className="text-sm text-[var(--color-muted)]">
            <AnimatedCounter value={0} duration={120} />
          </span>
        </div>
        <div className="w-full h-3 bg-[var(--color-border)]/20 rounded-full">
          <div className="h-full bg-[var(--color-muted)]/10 rounded-full flex items-center justify-center">
            <span className="text-xs text-[var(--color-muted)]">No data</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          <AnimatedCounter value={total} duration={120} />
        </span>
      </div>
      
      {/* Modern segmented bar with subtle glow */}
      <div className={`w-full h-3 bg-[var(--color-border)]/20 rounded-full overflow-hidden relative ${isAnimated ? 'transition-all duration-300 ease-out' : ''}`}>
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            {/* Much more distinct gradient variations */}
            <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={'var(--color-accent)'} stopOpacity="1" />
              <stop offset="100%" stopColor={'var(--color-accent)'} stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="investmentsGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={'var(--color-accent)'} stopOpacity="0.6" />
              <stop offset="100%" stopColor={'var(--color-accent)'} stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="creditGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={'var(--color-accent)'} stopOpacity="0.4" />
              <stop offset="100%" stopColor={'var(--color-accent)'} stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="loansGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={'var(--color-accent)'} stopOpacity="0.25" />
              <stop offset="100%" stopColor={'var(--color-accent)'} stopOpacity="0.08" />
            </linearGradient>
            {/* Subtle glow effect */}
            <filter id="segmentGlow">
              <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Render segments with subtle glow - colors must match legend */}
          {(() => {
            // Create all segments including zero amounts to match legend
            let allSegments = [];
            if (label === 'Assets') {
              allSegments = [
                { label: 'Cash', amount: segments.find(s => s.label === 'Cash')?.amount || 0 },
                { label: 'Investments', amount: segments.find(s => s.label === 'Investments')?.amount || 0 }
              ];
            } else if (label === 'Liabilities') {
              allSegments = [
                { label: 'Credit', amount: segments.find(s => s.label === 'Credit')?.amount || 0 },
                { label: 'Loans', amount: segments.find(s => s.label === 'Loans')?.amount || 0 }
              ];
            }
            
            return allSegments.map((segment, index) => {
              const percentage = (segment.amount / total) * 100;
              const leftOffset = allSegments.slice(0, index).reduce((sum, s) => sum + (s.amount / total) * 100, 0);
              
              // Determine gradient based on segment label - use same colors for similar categories
              let gradientId = 'cashGradient';
              
              if (segment.label === 'Investments') {
                gradientId = 'investmentsGradient';
              } else if (segment.label === 'Credit') {
                // Credit uses same color as Cash
                gradientId = 'cashGradient';
              } else if (segment.label === 'Loans') {
                // Loans uses same color as Investments
                gradientId = 'investmentsGradient';
              }
              
              return (
                <rect
                  key={`${segment.label}-${segment.amount}`}
                  x={`${leftOffset}%`}
                  y="0"
                  width={`${percentage}%`}
                  height="100%"
                  fill={`url(#${gradientId})`}
                  rx="1.5"
                  ry="1.5"
                  filter="url(#segmentGlow)"
                  className={isAnimated ? "transition-all duration-700 ease-in-out" : ""}
                  style={{
                    transition: isAnimated ? 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                  }}
                />
              );
            });
          })()}
        </svg>
      </div>
      
      {/* Modern legend with accent color variations - each key on its own row */}
      <div className="space-y-2 text-xs">
        {/* Show only relevant categories for this section */}
        {(() => {
          // Determine which categories to show based on the label
          let categoriesToShow = [];
          if (label === 'Assets') {
            categoriesToShow = [
              { label: 'Cash', amount: segments.find(s => s.label === 'Cash')?.amount || 0 },
              { label: 'Investments', amount: segments.find(s => s.label === 'Investments')?.amount || 0 }
            ];
          } else if (label === 'Liabilities') {
            categoriesToShow = [
              { label: 'Credit', amount: segments.find(s => s.label === 'Credit')?.amount || 0 },
              { label: 'Loans', amount: segments.find(s => s.label === 'Loans')?.amount || 0 }
            ];
          }
          
          return categoriesToShow.map((segment, index) => {
            // Use same colors for similar categories across assets and liabilities
            let dotColor = 'var(--color-accent)';
            let dotOpacity = '1';
            
            if (segment.label === 'Investments') {
              // Match investmentsGradient
              dotColor = 'var(--color-accent)';
              dotOpacity = '0.6';
            } else if (segment.label === 'Credit') {
              // Credit uses same color as Cash
              dotColor = 'var(--color-accent)';
              dotOpacity = '1';
            } else if (segment.label === 'Loans') {
              // Loans uses same color as Investments
              dotColor = 'var(--color-accent)';
              dotOpacity = '0.6';
            }
            
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shadow-sm" 
                    style={{ 
                      backgroundColor: dotColor,
                      opacity: dotOpacity
                    }}
                  />
                  <span className="text-[var(--color-muted)] font-medium">
                    {segment.label}
                  </span>
                </div>
                <span className="text-[var(--color-fg)] font-medium">
                  {formatCurrency(segment.amount)}
                </span>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

// Modern overall comparison bar using accent color
function OverallComparisonBar({ totalAssets, totalLiabilities, className = "", isAnimated = false }) {
  const netWorth = totalAssets - totalLiabilities;
  const totalNetWorth = totalAssets + totalLiabilities;
  
  if (totalNetWorth === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--color-fg)]">Net Worth</span>
          <span className="text-sm text-[var(--color-muted)]">
            <AnimatedCounter value={0} duration={120} />
          </span>
        </div>
        <div className="w-full h-3 bg-[var(--color-border)]/20 rounded-full">
          <div className="h-full bg-[var(--color-muted)]/10 rounded-full flex items-center justify-center">
            <span className="text-xs text-[var(--color-muted)]">No data</span>
          </div>
        </div>
      </div>
    );
  }

  const assetsPercentage = (totalAssets / totalNetWorth) * 100;
  const liabilitiesPercentage = (totalLiabilities / totalNetWorth) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">Net Worth</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          <AnimatedCounter value={netWorth} duration={120} />
        </span>
      </div>
      
      {/* Futuristic overall comparison bar with modern gradients */}
      <div className={`w-full h-4 bg-gradient-to-r from-[var(--color-border)]/10 to-[var(--color-border)]/5 rounded-full overflow-hidden relative shadow-inner ${isAnimated ? 'transition-all duration-300 ease-out' : ''}`}>
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            {/* Assets gradient - positive/accent color */}
            <linearGradient id="assetsOverallGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="1" />
              <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.6" />
            </linearGradient>
            {/* Liabilities gradient - muted accent color */}
            <linearGradient id="liabilitiesOverallGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
              <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.1" />
            </linearGradient>
            {/* Glow effects */}
            <filter id="overallGlow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Assets segment with glow */}
          <rect
            x="0"
            y="0"
            width={`${assetsPercentage}%`}
            height="100%"
            fill="url(#assetsOverallGradient)"
            rx="2"
            ry="2"
            filter="url(#overallGlow)"
            className={isAnimated ? "transition-all duration-700 ease-in-out" : ""}
            style={{
              transition: isAnimated ? 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
          
          {/* Liabilities segment with glow */}
          <rect
            x={`${assetsPercentage}%`}
            y="0"
            width={`${liabilitiesPercentage}%`}
            height="100%"
            fill="url(#liabilitiesOverallGradient)"
            rx="2"
            ry="2"
            filter="url(#overallGlow)"
            className={isAnimated ? "transition-all duration-700 ease-in-out" : ""}
            style={{
              transition: isAnimated ? 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
        </svg>
      </div>
      
      {/* Futuristic legend with accent color variations */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/80 shadow-sm" 
            style={{ 
              backgroundColor: 'var(--color-accent)',
              opacity: '1'
            }}
          />
          <span className="text-[var(--color-muted)] font-medium">Assets</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[var(--color-accent)]/30 to-[var(--color-accent)]/10 shadow-sm" 
            style={{ 
              backgroundColor: 'var(--color-accent)',
              opacity: '0.3'
            }}
          />
          <span className="text-[var(--color-muted)] font-medium">Liabilities</span>
        </div>
      </div>
    </div>
  );
}

export default function AccountsSummaryCard() {
  const { allAccounts, loading } = useAccounts();
  const { hoveredData, isHovering } = useNetWorthHover();
  const [animatedData, setAnimatedData] = useState(null);

  // Animate data changes when hover data changes
  useEffect(() => {
    if (hoveredData) {
      setAnimatedData(hoveredData);
    } else {
      // Reset to current data when not hovering
      setAnimatedData(null);
    }
  }, [hoveredData]);

  if (loading) {
    return (
      <Card width="1/3" className="animate-pulse">
        <div className="mb-6">
          <div className="h-4 bg-[var(--color-border)] rounded w-32" />
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-16" />
            <div className="h-3 bg-[var(--color-border)] rounded w-full" />
            <div className="flex gap-4">
              <div className="h-3 bg-[var(--color-border)] rounded w-12" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-[var(--color-border)] rounded w-20" />
            <div className="h-3 bg-[var(--color-border)] rounded w-3/4" />
            <div className="flex gap-4">
              <div className="h-3 bg-[var(--color-border)] rounded w-16" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Use hovered data if available, otherwise use current account data
  let assetsData, liabilitiesData, totalAssets, totalLiabilities;

  if (animatedData && animatedData.categorizedBalances) {
    // Use historical hovered data
    assetsData = {
      cash: animatedData.categorizedBalances.cash || 0,
      investments: animatedData.categorizedBalances.investments || 0,
    };
    liabilitiesData = {
      credit: animatedData.categorizedBalances.credit || 0,
      loans: animatedData.categorizedBalances.loans || 0,
    };
    totalAssets = animatedData.assets || 0;
    totalLiabilities = animatedData.liabilities || 0;
  } else {
    // Use current account data
    const categorizedAccounts = allAccounts.reduce((acc, account) => {
      const category = categorizeAccount(account);
      const amount = Math.abs(account.balance);
      
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += amount;
      
      return acc;
    }, {});

    assetsData = {
      cash: categorizedAccounts.cash || 0,
      investments: categorizedAccounts.investments || 0,
    };

    liabilitiesData = {
      credit: categorizedAccounts.credit || 0,
      loans: categorizedAccounts.loans || 0,
    };

    totalAssets = assetsData.cash + assetsData.investments;
    totalLiabilities = liabilitiesData.credit + liabilitiesData.loans;
  }

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
      <div className="mb-6">
        <div className="text-sm text-[var(--color-muted)]">Accounts Summary</div>
      </div>
      
      <div className="space-y-6">
        <SegmentedBar
          segments={assetSegments}
          total={totalAssets}
          label="Assets"
          isAnimated={isHovering}
        />
        
        <SegmentedBar
          segments={liabilitySegments}
          total={totalLiabilities}
          label="Liabilities"
          isAnimated={isHovering}
        />
      </div>
    </Card>
  );
}
