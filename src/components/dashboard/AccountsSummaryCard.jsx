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
  const [hoveredSegment, setHoveredSegment] = useState(null);

  if (total === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
          <span className="text-sm text-[var(--color-muted)]">
            <AnimatedCounter value={0} duration={120} />
          </span>
        </div>
        <div className="w-full h-3 bg-[var(--color-border)]/20 rounded-md">
          <div className="h-full bg-[var(--color-muted)]/10 rounded-md flex items-center justify-center">
            {/* Empty state */}
          </div>
        </div>
      </div>
    );
  }

  // Display value can be the specific hovered segment value or the total
  const displayValue = hoveredSegment ? hoveredSegment.amount : total;
  const displayLabel = hoveredSegment ? hoveredSegment.label : label;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center h-6">
        <span className="text-sm font-medium text-[var(--color-fg)] transition-all duration-200">
          {displayLabel}
        </span>
        <span className="text-sm font-medium text-[var(--color-fg)] transition-all duration-200">
          <AnimatedCounter value={displayValue} duration={120} />
        </span>
      </div>

      {/* Modern segmented bar with gaps and interaction */}
      <div
        className={`w-full h-3 flex ${isAnimated ? 'transition-all duration-300 ease-out' : ''}`}
        onMouseLeave={() => setHoveredSegment(null)}
      >
        {segments.map((segment, index) => {
          const percentage = (segment.amount / total) * 100;

          // Determine colors
          let color = 'var(--color-neon-green)';
          let border = 'none';

          if (segment.label === 'Investments') {
            color = 'color-mix(in srgb, var(--color-neon-green), transparent 90%)'; // Very transparent
            border = '1px solid color-mix(in srgb, var(--color-neon-green), transparent 50%)'; // Glassy border
          }
          else if (segment.label === 'Credit') color = '#ef4444';
          else if (segment.label === 'Loans') {
            color = 'color-mix(in srgb, #ef4444, transparent 90%)';
            border = '1px solid color-mix(in srgb, #ef4444, transparent 50%)';
          }

          const isHovered = hoveredSegment && hoveredSegment.label === segment.label;
          const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;

          return (
            <div
              key={segment.label}
              className={`h-full first:rounded-l-sm last:rounded-r-sm transition-all duration-200 cursor-pointer relative group`}
              style={{
                width: `${percentage}%`,
                backgroundColor: color,
                border: border,
                backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(0,0,0,0.1))',
                opacity: isDimmed ? 0.3 : 1,
                boxShadow: isHovered
                  ? `0 0 10px ${color}, inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)`
                  : 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)',
                zIndex: isHovered ? 10 : 1
              }}
              onMouseEnter={() => setHoveredSegment(segment)}
            />
          );
        })}
      </div>

      {/* Modern legend with hover interactions */}
      <div className="space-y-2 text-xs">
        {segments.map((segment, index) => {
          let dotColor = 'var(--color-neon-green)';
          let dotBorder = 'none';

          if (segment.label === 'Investments') {
            dotColor = 'color-mix(in srgb, var(--color-neon-green), transparent 90%)';
            dotBorder = '1px solid color-mix(in srgb, var(--color-neon-green), transparent 50%)';
          }
          else if (segment.label === 'Credit') dotColor = '#ef4444';
          else if (segment.label === 'Loans') {
            dotColor = 'color-mix(in srgb, #ef4444, transparent 90%)';
            dotBorder = '1px solid color-mix(in srgb, #ef4444, transparent 50%)';
          }

          const isHovered = hoveredSegment && hoveredSegment.label === segment.label;
          const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;

          return (
            <div
              key={index}
              className={`flex items-center justify-between transition-opacity duration-200 cursor-pointer hover:opacity-100 ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
              onMouseEnter={() => setHoveredSegment(segment)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: dotColor,
                    border: dotBorder,
                    boxShadow: isHovered ? `0 0 8px ${dotColor}` : `0 0 5px ${dotColor}`,
                    transform: isHovered ? 'scale(1.2)' : 'scale(1)'
                  }}
                />
                <span className={`text-[var(--color-muted)] font-light transition-colors ${isHovered ? 'text-[var(--color-fg)]' : ''}`}>
                  {segment.label}
                </span>
              </div>
              <span className={`text-[var(--color-fg)] font-light transition-all ${isHovered ? 'font-medium' : ''}`}>
                {formatCurrency(segment.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountsSummaryCard({ width = "full" }) {
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
      <Card width={width} className="animate-pulse" variant="glass">
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
    <Card width={width} variant="glass" className="h-full flex flex-col">
      <div className="mb-6">
        <div className="text-xs text-[var(--color-muted)] font-light uppercase tracking-wider">Accounts Summary</div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-8">
        <SegmentedBar
          segments={assetSegments}
          total={totalAssets}
          label="Assets"
          isAnimated={isHovering}
          className="flex-1 flex flex-col justify-center"
        />

        <div className="h-px bg-[var(--color-border)]/30 w-full" />

        <SegmentedBar
          segments={liabilitySegments}
          total={totalLiabilities}
          label="Liabilities"
          isAnimated={isHovering}
          className="flex-1 flex flex-col justify-center"
        />
      </div>
    </Card>
  );
}
