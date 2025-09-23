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

// Simplified segmented bar component
function SegmentedBar({ segments, total, label, className = "", isAnimated = false }) {
  if (total === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <span className="text-sm text-[var(--color-muted)]">
          <AnimatedCounter value={0} duration={120} />
        </span>
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
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          <AnimatedCounter value={total} duration={120} />
        </span>
      </div>
      
      {/* Segmented bar with distinct colors */}
      <div className={`w-full h-2 bg-[var(--color-border)]/30 rounded-full overflow-hidden relative ${isAnimated ? 'transition-all duration-300 ease-out' : ''}`}>
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
                key={`${segment.label}-${segment.amount}`}
                x={`${leftOffset}%`}
                y="0"
                width={`${percentage}%`}
                height="100%"
                fill={`url(#${gradientId})`}
                rx="0"
                ry="0"
                className={isAnimated ? "transition-all duration-700 ease-in-out" : ""}
                style={{
                  transition: isAnimated ? 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                }}
              />
            );
          })}
        </svg>
      </div>
      
      {/* Simple legend */}
      <div className="flex gap-4 text-xs">
        {segments.map((segment, index) => {
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
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-[var(--color-muted)] font-medium">
                {segment.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simplified overall comparison bar
function OverallComparisonBar({ totalAssets, totalLiabilities, className = "", isAnimated = false }) {
  const netWorth = totalAssets - totalLiabilities;
  const totalNetWorth = totalAssets + totalLiabilities;
  
  if (totalNetWorth === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">Net Worth</span>
        <span className="text-sm text-[var(--color-muted)]">
          <AnimatedCounter value={0} duration={120} />
        </span>
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
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-[var(--color-fg)]">Net Worth</span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          <AnimatedCounter value={netWorth} duration={120} />
        </span>
      </div>
      
      {/* Overall comparison bar */}
      <div className={`w-full h-2 bg-[var(--color-border)]/30 rounded-full overflow-hidden relative ${isAnimated ? 'transition-all duration-300 ease-out' : ''}`}>
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
            className={isAnimated ? "transition-all duration-700 ease-in-out" : ""}
            style={{
              transition: isAnimated ? 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
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
            className={isAnimated ? "transition-all duration-700 ease-in-out" : ""}
            style={{
              transition: isAnimated ? 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
        </svg>
      </div>
      
      {/* Simple legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[var(--color-muted)] font-medium">Assets</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
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
        <div className="text-sm font-medium text-[var(--color-fg)]">Accounts Summary</div>
      </div>
      
      <div className="space-y-6">
        <OverallComparisonBar
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          isAnimated={isHovering}
        />
        
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
