"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Card from "../ui/Card";
import { useAccounts } from "../AccountsProvider";
import { useNetWorthHover } from "./NetWorthHoverContext";

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, duration = 120 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const animationRef = useRef(null);

  useEffect(() => {
    if (displayValue === value) return;

    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
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
  }, [value, duration]);

  return (
    <span>{formatCurrency(displayValue)}</span>
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

  const liabilityTypes = [
    'credit card', 'credit', 'loan', 'mortgage',
    'line of credit', 'overdraft', 'other'
  ];

  const isLiability = liabilityTypes.some(type => fullType.includes(type));

  if (isLiability) {
    if (fullType.includes('credit card') || fullType.includes('credit')) {
      return 'credit';
    } else if (fullType.includes('loan') || fullType.includes('mortgage') || fullType.includes('line of credit')) {
      return 'loans';
    } else {
      return 'credit';
    }
  } else {
    if (fullType.includes('investment') || fullType.includes('brokerage') ||
      fullType.includes('401k') || fullType.includes('ira') ||
      fullType.includes('retirement') || fullType.includes('mutual fund') ||
      fullType.includes('stock') || fullType.includes('bond')) {
      return 'investments';
    } else {
      return 'cash';
    }
  }
}

// Modern segmented bar component using accent color
function SegmentedBar({ segments, total, label, className = "", isAnimated = false }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  if (total === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
          <span className="text-sm font-semibold text-[var(--color-fg)]">
            <AnimatedCounter value={0} duration={120} />
          </span>
        </div>
        <div className="w-full h-2 bg-[var(--color-border)]/20 rounded-full overflow-hidden" />
      </div>
    );
  }

  const displayTotal = total;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-[var(--color-fg)]">
          {label}
        </span>
        <span className="text-sm font-semibold text-[var(--color-fg)]">
          <AnimatedCounter value={displayTotal} duration={120} />
        </span>
      </div>

      {/* Bar */}
      <div
        className="w-full h-3 flex rounded-full overflow-hidden bg-[var(--color-surface)]"
        onMouseLeave={() => setHoveredSegment(null)}
      >
        {segments.map((segment) => {
          const percentage = (segment.amount / total) * 100;
          let color;

          // Updated Colors
          if (segment.label === 'Investments') color = 'var(--color-neon-green)';
          else if (segment.label === 'Cash') color = '#059669'; // Emerald-600
          else if (segment.label === 'Credit') color = '#ef4444'; // Red-500
          else if (segment.label === 'Loans') color = '#b91c1c'; // Red-700
          else color = 'var(--color-muted)';

          const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;

          return (
            <div
              key={segment.label}
              className="h-full transition-all duration-200 cursor-pointer"
              style={{
                width: `${percentage}%`,
                backgroundColor: color,
                opacity: isDimmed ? 0.3 : 1,
              }}
              onMouseEnter={() => setHoveredSegment(segment)}
            />
          );
        })}
      </div>

      {/* Vertical Legend */}
      <div className="space-y-2 pt-1">
        {segments.map((segment, index) => {
          let color;
          if (segment.label === 'Investments') color = 'var(--color-neon-green)';
          else if (segment.label === 'Cash') color = '#059669';
          else if (segment.label === 'Loans') color = '#b91c1c';
          else if (segment.label === 'Credit') color = '#ef4444';

          const isHovered = hoveredSegment && hoveredSegment.label === segment.label;
          const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;
          const percentage = ((segment.amount / total) * 100).toFixed(1);

          return (
            <div
              key={index}
              className={`flex items-center justify-between text-xs transition-opacity duration-200 cursor-pointer ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
              onMouseEnter={() => setHoveredSegment(segment)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className={`text-[var(--color-muted)] ${isHovered ? 'text-[var(--color-fg)]' : ''}`}>
                  {segment.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[var(--color-fg)] font-medium tabular-nums ${isHovered ? 'text-[var(--color-fg)]' : ''}`}>
                  {formatCurrency(segment.amount)}
                </span>
                <span className="text-[var(--color-muted)] font-mono text-[10px]">{percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const useAccountData = () => {
  const { allAccounts, loading } = useAccounts();
  const { hoveredData } = useNetWorthHover();

  return useMemo(() => {
    if (loading) return { loading: true };

    let assetsData, liabilitiesData, totalAssets, totalLiabilities;

    if (hoveredData && hoveredData.categorizedBalances) {
      assetsData = {
        cash: hoveredData.categorizedBalances.cash || 0,
        investments: hoveredData.categorizedBalances.investments || 0,
      };
      liabilitiesData = {
        credit: hoveredData.categorizedBalances.credit || 0,
        loans: hoveredData.categorizedBalances.loans || 0,
      };
      totalAssets = hoveredData.assets || 0;
      totalLiabilities = hoveredData.liabilities || 0;
    } else {
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

    const assetSegments = [
      { label: 'Cash', amount: assetsData.cash },
      { label: 'Investments', amount: assetsData.investments },
    ].filter(segment => segment.amount > 0);

    const liabilitySegments = [
      { label: 'Credit', amount: liabilitiesData.credit },
      { label: 'Loans', amount: liabilitiesData.loans },
    ].filter(segment => segment.amount > 0);

    return {
      loading: false,
      assetSegments,
      liabilitySegments,
      totalAssets,
      totalLiabilities
    };

  }, [allAccounts, loading, hoveredData]);
};

export function AssetsCard({ width = "full" }) {
  const { loading, assetSegments, totalAssets } = useAccountData();
  const { isHovering } = useNetWorthHover();

  if (loading) return <Card width={width} className="animate-pulse h-40" variant="glass" />;

  return (
    <Card width={width} variant="glass" className="flex flex-col">
      <div className="mb-4">
        <div className="text-xs text-[var(--color-muted)] font-light uppercase tracking-wider">Assets</div>
      </div>
      <SegmentedBar
        segments={assetSegments}
        total={totalAssets}
        label="Total Assets"
        isAnimated={isHovering}
      />
    </Card>
  );
}

export function LiabilitiesCard({ width = "full" }) {
  const { loading, liabilitySegments, totalLiabilities } = useAccountData();
  const { isHovering } = useNetWorthHover();

  if (loading) return <Card width={width} className="animate-pulse h-40" variant="glass" />;

  return (
    <Card width={width} variant="glass" className="flex flex-col">
      <div className="mb-4">
        <div className="text-xs text-[var(--color-muted)] font-light uppercase tracking-wider">Liabilities</div>
      </div>
      <SegmentedBar
        segments={liabilitySegments}
        total={totalLiabilities}
        label="Total Liabilities"
        isAnimated={isHovering}
      />
    </Card>
  );
}

// Keep default export for backwards compatibility until all usages are updated
export default function AccountsSummaryCard(props) {
  return (
    <div className="space-y-6">
      <AssetsCard {...props} />
      <LiabilitiesCard {...props} />
    </div>
  );
}
