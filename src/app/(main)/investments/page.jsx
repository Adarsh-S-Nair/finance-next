"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageContainer from "../../../components/PageContainer";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import LineChart from "../../../components/ui/LineChart";
import { LuPlus, LuBot, LuTrendingUp, LuTrendingDown, LuTrash2, LuSettings, LuChevronRight } from "react-icons/lu";
import { SiGooglegemini, SiX } from "react-icons/si";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";

// Logo display component with error handling
function LogoDisplay({ logo, ticker }) {
  const [imageError, setImageError] = useState(false);

  if (!logo || imageError) {
    return (
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        }}
      >
        {ticker.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt={ticker}
      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      style={{ border: '1px solid var(--color-border)' }}
      onError={() => setImageError(true)}
    />
  );
}

// AI Provider and Model configurations
const AI_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    icon: SiGooglegemini,
    color: '#4285F4',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Free tier - best for testing' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    icon: SiX,
    color: '#000000',
    models: [
      { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast', description: 'Reasoning - $0.20/$0.50 per M tokens', disabled: true },
    ],
  },
];

// Flat lookup for model info
const AI_MODELS = {};
AI_PROVIDERS.forEach(provider => {
  provider.models.forEach(model => {
    AI_MODELS[model.id] = {
      ...model,
      icon: provider.icon,
      color: provider.color,
      provider: provider.name,
    };
  });
});

// Starting capital presets
const CAPITAL_PRESETS = [10000, 50000, 100000, 500000, 1000000];

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format percentage
const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

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

// Portfolio Detail View Component (full chart view)
function PortfolioDetailView({ portfolio, onClose, onDeleteClick, showSettings, onCloseSettings }) {
  const { profile } = useUser();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  const [timeRange, setTimeRange] = useState('ALL');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);
  const [stockQuotes, setStockQuotes] = useState({}); // { TICKER: { price, cached } }

  // Calculate current total value: use latest snapshot if available, otherwise use current_cash
  const [holdings, setHoldings] = useState([]);
  const currentTotalValue = useMemo(() => {
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[snapshots.length - 1];
      return parseFloat(latestSnapshot.total_value) || portfolio.current_cash;
    }

    let holdingsValue = 0;
    if (holdings.length > 0) {
      holdingsValue = holdings.reduce((sum, holding) => {
        const shares = parseFloat(holding.shares) || 0;
        const avgCost = parseFloat(holding.avg_cost) || 0;
        return sum + (shares * avgCost);
      }, 0);
    }

    const cash = parseFloat(portfolio.current_cash) || 0;
    return cash + holdingsValue;
  }, [snapshots, holdings, portfolio.current_cash]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: snapshotsData, error: snapshotsError } = await supabase
          .from('ai_portfolio_snapshots')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('snapshot_date', { ascending: true });

        if (snapshotsError) throw snapshotsError;
        setSnapshots(snapshotsData || []);

        const { data: holdingsData, error: holdingsError } = await supabase
          .from('ai_portfolio_holdings')
          .select('*')
          .eq('portfolio_id', portfolio.id);

        if (holdingsError) throw holdingsError;

        // Fetch ticker logos for all holdings
        if (holdingsData && holdingsData.length > 0) {
          const tickers = holdingsData.map(h => h.ticker.toUpperCase());
          const { data: tickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector')
            .in('symbol', tickers);

          // Create a map of ticker to logo/name/sector
          const tickerMap = new Map();
          if (tickersData) {
            tickersData.forEach(t => {
              tickerMap.set(t.symbol, { logo: t.logo, name: t.name, sector: t.sector });
            });
          }

          // Add logo/name/sector to each holding
          const holdingsWithLogos = holdingsData.map(holding => ({
            ...holding,
            logo: tickerMap.get(holding.ticker.toUpperCase())?.logo || null,
            companyName: tickerMap.get(holding.ticker.toUpperCase())?.name || null,
            sector: tickerMap.get(holding.ticker.toUpperCase())?.sector || null,
          }));

          setHoldings(holdingsWithLogos);

          // Fetch current stock prices
          try {
            const tickerList = tickers.join(',');
            const quotesRes = await fetch(`/api/market-data/quotes?tickers=${tickerList}`);
            if (quotesRes.ok) {
              const quotesData = await quotesRes.json();
              setStockQuotes(quotesData.quotes || {});
            }
          } catch (quotesErr) {
            console.error('Error fetching stock quotes:', quotesErr);
          }
        } else {
          setHoldings([]);
        }
      } catch (err) {
        console.error('Error fetching portfolio data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolio.id]);

  const chartData = useMemo(() => {
    const data = snapshots.map((snapshot) => {
      const date = new Date(snapshot.snapshot_date);
      return {
        month: date.toLocaleString('en-US', { month: 'short' }),
        monthFull: date.toLocaleString('en-US', { month: 'long' }),
        year: date.getFullYear(),
        date: date,
        dateString: snapshot.snapshot_date,
        value: parseFloat(snapshot.total_value) || 0,
      };
    });

    if (data.length === 0 && currentTotalValue) {
      const now = new Date();
      data.push({
        month: now.toLocaleString('en-US', { month: 'short' }),
        monthFull: now.toLocaleString('en-US', { month: 'long' }),
        year: now.getFullYear(),
        date: now,
        dateString: now.toISOString().split('T')[0],
        value: currentTotalValue,
      });
    }
    return data;
  }, [snapshots, currentTotalValue]);

  const filteredData = useMemo(() => {
    if (chartData.length === 0) return [];
    if (timeRange === 'ALL') return chartData;

    const now = new Date();
    let startDate = new Date(now);

    switch (timeRange) {
      case '1D':
        startDate.setDate(now.getDate() - 1);
        break;
      case '1W':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return chartData;
    }

    const filtered = chartData.filter(item => item.date >= startDate);
    if (filtered.length === 0 && chartData.length > 0) {
      return [chartData[chartData.length - 1]];
    }
    return filtered;
  }, [chartData, timeRange]);

  const displayChartData = useMemo(() => {
    if (filteredData.length <= 1) {
      const singlePoint = filteredData.length === 1 ? filteredData[0] : (chartData.length > 0 ? chartData[chartData.length - 1] : null);
      if (!singlePoint) return [];

      const originalDate = new Date(singlePoint.date);
      const earlierDate = new Date(originalDate);
      let daysOffset = 30;
      if (timeRange === '1D') daysOffset = 1;
      if (timeRange === '1W') daysOffset = 7;

      earlierDate.setDate(earlierDate.getDate() - daysOffset);

      const flatLinePoint = {
        ...singlePoint,
        month: earlierDate.toLocaleString('en-US', { month: 'short' }),
        monthFull: earlierDate.toLocaleString('en-US', { month: 'long' }),
        year: earlierDate.getFullYear(),
        date: earlierDate,
        dateString: earlierDate.toISOString().split('T')[0],
      };

      return [flatLinePoint, singlePoint];
    }
    return filteredData;
  }, [filteredData, chartData, timeRange]);

  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return 'var(--color-success)';
    const startValue = displayChartData[0].value;
    const endValue = displayChartData[displayChartData.length - 1].value;
    return endValue >= startValue ? 'var(--color-success)' : 'var(--color-danger)';
  }, [displayChartData]);

  const availableRanges = useMemo(() => {
    if (chartData.length === 0) return ['ALL'];

    const now = new Date();
    const oldestDate = chartData[0].date;
    const diffTime = Math.abs(now.getTime() - oldestDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const ranges = [];
    if (diffDays > 0) ranges.push('1D');
    if (diffDays > 7) ranges.push('1W');
    if (diffDays > 30) ranges.push('1M');
    if (diffDays > 90) ranges.push('3M');

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    if (oldestDate < startOfYear) ranges.push('YTD');

    if (diffDays > 365) ranges.push('1Y');
    ranges.push('ALL');

    return ranges;
  }, [chartData]);

  const currentData = activeIndex !== null ? displayChartData[activeIndex] : displayChartData[displayChartData.length - 1];
  const fallbackData = {
    value: currentTotalValue || portfolio.starting_capital,
    dateString: new Date().toISOString().split('T')[0],
    monthFull: new Date().toLocaleString('en-US', { month: 'long' }),
    year: new Date().getFullYear()
  };
  const displayData = currentData || fallbackData;

  const dynamicPercentChange = useMemo(() => {
    if (displayChartData.length < 1) return 0;
    const startValue = displayChartData[0].value;
    const currentValue = displayData.value;
    if (startValue === 0) return 0;
    return ((currentValue - startValue) / Math.abs(startValue)) * 100;
  }, [displayChartData, displayData]);

  const handleMouseMove = (data, index) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  const handleCardMouseLeave = () => {
    setActiveIndex(null);
  };

  const accentColor = profile?.accent_color && profile.accent_color.startsWith('#')
    ? profile.accent_color
    : (typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--color-neon-blue').trim()
      : '#00f3ff');
  const validAccentColor = accentColor && accentColor.startsWith('#') ? accentColor : '#00f3ff';

  // Calculate portfolio overview metrics (must be before early return)
  const portfolioMetrics = useMemo(() => {
    const cash = parseFloat(portfolio.current_cash) || 0;

    // Calculate holdings value (using avg_cost as current price estimate)
    let totalHoldingsValue = 0;
    const holdingsWithValues = holdings.map(holding => {
      const shares = parseFloat(holding.shares) || 0;
      const avgCost = parseFloat(holding.avg_cost) || 0;
      const value = shares * avgCost;
      totalHoldingsValue += value;

      return {
        ...holding,
        shares,
        avgCost,
        value,
        percentage: 0 // Will calculate after we know total
      };
    });

    const totalPortfolioValue = cash + totalHoldingsValue;

    // Calculate percentages
    holdingsWithValues.forEach(holding => {
      holding.percentage = totalPortfolioValue > 0 ? (holding.value / totalPortfolioValue) * 100 : 0;
    });

    // Sort by value (largest first)
    holdingsWithValues.sort((a, b) => b.value - a.value);

    return {
      cash,
      totalHoldingsValue,
      totalPortfolioValue,
      holdingsWithValues,
      cashPercentage: totalPortfolioValue > 0 ? (cash / totalPortfolioValue) * 100 : 0
    };
  }, [holdings, portfolio.current_cash]);

  const handleDeleteClick = () => {
    if (onCloseSettings) onCloseSettings();
    setDeleteModal({ isOpen: true });
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ai_portfolios')
        .delete()
        .eq('id', portfolio.id);

      if (error) throw error;

      if (onDeleteClick) {
        onDeleteClick(portfolio);
      }

      setDeleteModal({ isOpen: false });
      onClose(); // Close the detail view
    } catch (err) {
      console.error('Error deleting portfolio:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card variant="glass" className="animate-pulse">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-2" />
            <div className="h-6 bg-[var(--color-border)] rounded w-32" />
          </div>
        </div>
        <div className="mt-4 h-32 bg-[var(--color-border)] rounded" />
      </Card>
    );
  }

  return (
    <>
      {/* Main Layout: Chart + Summary Side by Side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chart Card - 2/3 width */}
        <div className="lg:w-2/3">
          <Card variant="glass" padding="none" onMouseLeave={handleCardMouseLeave}>
            <div className="mb-4 px-6 pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">Portfolio Value</div>
                  <div className="flex flex-col">
                    <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight drop-shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.1)]">
                      <AnimatedCounter value={displayData?.value || 0} duration={120} />
                    </div>
                    <div className={`text-xs font-medium mt-0.5 ${dynamicPercentChange > 0 ? 'text-emerald-500' :
                      dynamicPercentChange < 0 ? 'text-rose-500' :
                        'text-[var(--color-muted)]'
                      }`}>
                      {dynamicPercentChange > 0 ? '+' : ''}
                      {formatCurrency(displayData.value - (displayChartData[0]?.value || 0))}
                      {' '}
                      ({dynamicPercentChange > 0 ? '+' : ''}{dynamicPercentChange.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-[var(--color-muted)] font-medium">
                    {displayData?.dateString ?
                      new Date(displayData.dateString).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) :
                      `${displayData?.monthFull || 'Current'} ${displayData?.year || new Date().getFullYear()}`
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 pb-2">
              <div
                className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
                tabIndex={-1}
                style={{ outline: 'none', height: '200px' }}
                onMouseLeave={handleMouseLeave}
              >
                <LineChart
                  data={displayChartData}
                  dataKey="value"
                  width="100%"
                  height={200}
                  margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
                  strokeColor={chartColor}
                  strokeWidth={2}
                  showArea={true}
                  areaOpacity={0.15}
                  showDots={false}
                  dotRadius={4}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  showTooltip={false}
                  gradientId={`portfolioDetailGradient-${portfolio.id}`}
                  curveType="monotone"
                  animationDuration={800}
                  xAxisDataKey="dateString"
                  yAxisDomain={['dataMin', 'dataMax']}
                />
              </div>
            </div>

            <div className="mt-2 pt-2 px-6 pb-4 border-t border-[var(--color-border)]/50">
              <div className="flex justify-between items-center w-full">
                {availableRanges.map((range) => {
                  const isActive = timeRange === range;
                  const isDefaultAccent = !profile?.accent_color || profile.accent_color === validAccentColor;
                  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
                  const activeTextColor = (isDarkMode && isDefaultAccent) ? 'var(--color-on-accent)' : '#fff';

                  return (
                    <div key={range} className="flex-1 flex justify-center">
                      <button
                        onClick={() => setTimeRange(range)}
                        className="relative px-3 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none focus:outline-none"
                        style={{
                          color: isActive ? activeTextColor : 'var(--color-muted)'
                        }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId={`portfolioTimeRange-${portfolio.id}`}
                            className="absolute inset-0 bg-[var(--color-accent)] rounded-full"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                        <span className={`relative z-10 ${!isActive ? "hover:text-[var(--color-fg)]" : ""}`}>
                          {range}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Summary Card - 1/3 width */}
        <div className="lg:w-1/3 flex flex-col gap-4">
          <Card variant="glass" padding="md" className="flex-1">
            {/* Total Value - Hero */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Total Value</span>
                {(() => {
                  const returnPercent = ((portfolioMetrics.totalPortfolioValue - portfolio.starting_capital) / portfolio.starting_capital) * 100;
                  const isPositive = returnPercent >= 0;
                  return (
                    <span className={`text-xs font-medium tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isPositive ? '+' : ''}{returnPercent.toFixed(2)}%
                    </span>
                  );
                })()}
              </div>
              <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight">
                {formatCurrency(portfolioMetrics.totalPortfolioValue)}
              </div>
              <div className="text-xs text-[var(--color-muted)] mt-1">
                {formatCurrency(portfolio.starting_capital)} initial
              </div>
            </div>

            {/* Allocation Bar Visualization */}
            <div className="mb-5">
              <div className="flex h-2 rounded-full overflow-hidden bg-[var(--color-border)]/30">
                {/* Holdings portion */}
                <div
                  className="bg-[var(--color-accent)] transition-all"
                  style={{ width: `${100 - portfolioMetrics.cashPercentage}%` }}
                />
                {/* Cash portion */}
                <div
                  className="bg-[var(--color-muted)]/40 transition-all"
                  style={{ width: `${portfolioMetrics.cashPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-[var(--color-muted)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  <span>Invested</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-muted)]/40" />
                  <span>Cash</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Cash */}
              <div className="p-3 rounded-lg bg-[var(--color-surface)]/50">
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1">Cash</div>
                <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(portfolioMetrics.cash)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)] tabular-nums mt-0.5">
                  {portfolioMetrics.cashPercentage.toFixed(1)}% available
                </div>
              </div>

              {/* Holdings */}
              <div className="p-3 rounded-lg bg-[var(--color-surface)]/50">
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-1">Holdings</div>
                <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(portfolioMetrics.totalHoldingsValue)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                  {holdings.length} position{holdings.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Top Holdings Preview */}
            {holdings.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[var(--color-border)]/30">
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mb-3">Top Holdings</div>
                <div className="space-y-2">
                  {portfolioMetrics.holdingsWithValues.slice(0, 3).map((holding) => (
                    <div key={holding.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] text-[var(--color-muted)]"
                          style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)'
                          }}
                        >
                          {holding.logo ? (
                            <img src={holding.logo} alt={holding.ticker} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            holding.ticker.charAt(0)
                          )}
                        </div>
                        <span className="text-xs font-medium text-[var(--color-fg)]">{holding.ticker}</span>
                      </div>
                      <span className="text-xs text-[var(--color-muted)] tabular-nums">
                        {holding.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Holdings Section */}
      <Card variant="glass" padding="none" className="mt-6">
        <div className="px-6 pt-6 pb-4">
          <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Holdings</div>
        </div>

        {portfolioMetrics.holdingsWithValues.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)]/20">
            {portfolioMetrics.holdingsWithValues.map((holding) => {
              // Calculate real gain/loss from current market price vs avg cost
              const quote = stockQuotes[holding.ticker];
              const currentPrice = quote?.price || null;
              const avgCost = holding.avgCost;

              // Calculate gain/loss percentage: ((current - avg) / avg) * 100
              let gainPercent = null;
              let currentValue = holding.value; // Default to cost basis value

              if (currentPrice && avgCost > 0) {
                gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
                currentValue = holding.shares * currentPrice;
              }

              const isUp = gainPercent !== null && gainPercent >= 0;
              const hasQuote = gainPercent !== null;

              return (
                <div
                  key={holding.id}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-[var(--color-surface)]/20 transition-colors"
                >
                  {/* Left: Logo + Name/Ticker */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        background: holding.logo ? 'transparent' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      {holding.logo ? (
                        <img src={holding.logo} alt={holding.ticker} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">{holding.ticker.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-[var(--color-fg)] truncate">
                        {holding.companyName || holding.ticker}
                      </div>
                      <div className="text-xs text-[var(--color-muted)] mt-0.5">
                        {holding.ticker}{holding.sector && ` · ${holding.sector}`}
                      </div>
                    </div>
                  </div>

                  {/* Center: Shares */}
                  <div className="text-right px-4 hidden sm:block">
                    <div className="text-sm text-[var(--color-muted)] tabular-nums">
                      {holding.shares.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]/60 uppercase tracking-wider mt-0.5">
                      shares
                    </div>
                  </div>

                  {/* Right: Value + Performance */}
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm text-[var(--color-fg)] tabular-nums">
                      {formatCurrency(currentValue)}
                    </div>
                    {hasQuote ? (
                      <div className={`text-xs tabular-nums mt-0.5 ${Math.abs(gainPercent) < 0.005 ? 'text-[var(--color-muted)]' :
                          gainPercent > 0 ? 'text-emerald-500/80' :
                            'text-rose-500/80'
                        }`}>
                        {gainPercent > 0.005 ? '+' : ''}{gainPercent.toFixed(2)}%
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--color-muted)]/50 mt-0.5">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <div className="text-[var(--color-muted)] text-sm">
              No holdings yet. The AI hasn't made any trades.
            </div>
          </div>
        )}
      </Card>

      {/* Portfolio Settings Drawer */}
      <Drawer
        isOpen={showSettings}
        onClose={onCloseSettings}
        title="Portfolio Settings"
        description="Manage your portfolio configuration"
        size="md"
      >
        <div className="space-y-6 pt-2">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-fg)] mb-2">Danger Zone</h3>
            <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-fg)]">Delete Portfolio</p>
                <Button
                  variant="danger"
                  onClick={handleDeleteClick}
                  className="ml-4"
                  size="icon"
                >
                  <LuTrash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${portfolio.name}`}
        description="This will permanently delete this portfolio and all its trading history. This action cannot be undone."
        confirmLabel="Delete Portfolio"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDeleting}
        busyLabel="Deleting..."
      />
    </>
  );
}

// Portfolio Card Component
function PortfolioCard({ portfolio, onDeleteClick, onCardClick }) {
  const model = AI_MODELS[portfolio.ai_model] || {
    name: portfolio.ai_model,
    icon: LuBot,
    color: 'var(--color-accent)',
  };
  const ModelIcon = model.icon;

  const [snapshots, setSnapshots] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch portfolio snapshots and holdings
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch snapshots
        const { data: snapshotsData, error: snapshotsError } = await supabase
          .from('ai_portfolio_snapshots')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('snapshot_date', { ascending: true });

        if (snapshotsError) throw snapshotsError;
        setSnapshots(snapshotsData || []);

        // Fetch current holdings
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('ai_portfolio_holdings')
          .select('*')
          .eq('portfolio_id', portfolio.id);

        if (holdingsError) throw holdingsError;
        setHoldings(holdingsData || []);
      } catch (err) {
        console.error('Error fetching portfolio data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolio.id]);

  // Calculate current total value: use latest snapshot if available, otherwise calculate from cash + holdings
  const currentTotalValue = useMemo(() => {
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[snapshots.length - 1];
      return parseFloat(latestSnapshot.total_value) || portfolio.current_cash;
    }

    // If no snapshots, calculate: cash + (sum of holdings value at current/market prices)
    // For now, use avg_cost as proxy for current price (since we'd need to fetch live prices)
    // This gives a reasonable estimate, though actual value may vary with market prices
    let holdingsValue = 0;
    if (holdings.length > 0) {
      holdingsValue = holdings.reduce((sum, holding) => {
        const shares = parseFloat(holding.shares) || 0;
        const avgCost = parseFloat(holding.avg_cost) || 0;
        return sum + (shares * avgCost);
      }, 0);
    }

    const cash = parseFloat(portfolio.current_cash) || 0;
    return cash + holdingsValue;
  }, [snapshots, holdings, portfolio.current_cash]);

  // Process snapshot data for the chart - simple array of values
  const chartData = useMemo(() => {
    if (snapshots.length > 0) {
      return snapshots.map((snapshot) => parseFloat(snapshot.total_value) || 0);
    }

    // If no snapshots, create a simple line from starting capital to current value
    if (currentTotalValue !== portfolio.starting_capital) {
      return [portfolio.starting_capital, currentTotalValue];
    }

    return [portfolio.starting_capital];
  }, [snapshots, currentTotalValue, portfolio.starting_capital]);

  // Calculate percentage change from starting capital
  const percentChange = useMemo(() => {
    const startValue = portfolio.starting_capital;
    const currentValue = currentTotalValue;
    if (startValue === 0) return 0;
    return ((currentValue - startValue) / Math.abs(startValue)) * 100;
  }, [currentTotalValue, portfolio.starting_capital]);

  const returnAmount = currentTotalValue - portfolio.starting_capital;

  // Calculate chart color based on performance
  const chartColor = useMemo(() => {
    return currentTotalValue >= portfolio.starting_capital ? 'var(--color-success)' : 'var(--color-danger)';
  }, [currentTotalValue, portfolio.starting_capital]);

  const createdDate = new Date(portfolio.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Generate smooth path for SVG chart
  const generateSmoothPath = (points) => {
    if (points.length < 2) return "";
    return points.reduce((acc, point, i, a) => {
      if (i === 0) return `M ${point[0]},${point[1]}`;
      const [cpsX, cpsY] = a[i - 1];
      const [cpeX, cpeY] = point;
      const cp1x = cpsX + (cpeX - cpsX) / 3;
      const cp1y = cpsY;
      const cp2x = cpsX + (cpeX - cpsX) * 2 / 3;
      const cp2y = cpeY;
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${cpeX},${cpeY}`;
    }, "");
  };

  // Generate chart paths
  const { areaPath, linePath } = useMemo(() => {
    if (!chartData || chartData.length < 2) return { areaPath: "", linePath: "" };

    const width = 100;
    const height = 100;
    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const range = max - min || 1;
    // Add padding to prevent flat lines at top/bottom
    const padding = range * 0.2;
    const adjustedMin = min - padding;
    const adjustedRange = range + padding * 2;
    const stepX = width / (chartData.length - 1);

    const points = chartData.map((val, i) => {
      const x = i * stepX;
      // Invert Y because SVG 0 is top
      const y = height - ((val - adjustedMin) / adjustedRange) * height;
      return [x, y];
    });

    const smoothLine = generateSmoothPath(points);
    const area = `${smoothLine} L ${width},${height} L 0,${height} Z`;

    return { areaPath: area, linePath: smoothLine };
  }, [chartData]);

  if (loading) {
    return (
      <Card className="group relative animate-pulse" variant="glass">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-2" />
            <div className="h-6 bg-[var(--color-border)] rounded w-32" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="group relative overflow-hidden h-40 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
      variant="glass"
      padding="none"
      onClick={onCardClick}
    >
      {/* Removed delete button - now accessible via settings drawer */}

      <div className="p-4 relative z-10">
        <div className="flex items-center justify-between mb-3">
          {/* Header */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${model.color}20` }}
            >
              <ModelIcon
                className="w-4 h-4"
                style={{ color: model.color === '#000000' ? 'var(--color-fg)' : model.color }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-[var(--color-fg)] truncate">{portfolio.name}</h3>
              <p className="text-xs text-[var(--color-muted)]">{model.name}</p>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <div className="text-lg font-semibold text-[var(--color-fg)] tracking-tight">
            <AnimatedCounter value={currentTotalValue || 0} duration={120} />
          </div>
          <div className={`text-xs font-medium mt-0.5 ${percentChange > 0 ? 'text-emerald-500' :
            percentChange < 0 ? 'text-rose-500' :
              'text-[var(--color-muted)]'
            }`}>
            {returnAmount >= 0 ? '+' : ''}{formatCurrency(returnAmount)}
            {' '}
            ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mt-2">
          <span>{formatCurrency(portfolio.starting_capital)} initial</span>
          <span>{createdDate}</span>
        </div>
      </div>

      {/* Chart Layer - Background */}
      <div className="absolute bottom-0 left-0 right-0 h-20 w-full z-0 pointer-events-none opacity-30">
        {chartData.length > 1 && (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id={`portfolioGradient-${portfolio.id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={chartColor === 'var(--color-success)' ? '#10b981' : '#ef4444'} stopOpacity="0.15" />
                <stop offset="100%" stopColor={chartColor === 'var(--color-success)' ? '#10b981' : '#ef4444'} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={areaPath}
              fill={`url(#portfolioGradient-${portfolio.id})`}
              className="transition-all duration-1000 ease-out"
            />
            <path
              d={linePath}
              fill="none"
              stroke={chartColor === 'var(--color-success)' ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="transition-all duration-1000 ease-out opacity-40"
            />
          </svg>
        )}
      </div>
    </Card>
  );
}

// Create Portfolio Drawer
function CreatePortfolioDrawer({ isOpen, onClose, onCreated }) {
  const { profile } = useUser();
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [startingCapital, setStartingCapital] = useState(100000);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  // Capital bounds
  const MIN_CAPITAL = 1000;
  const MAX_CAPITAL = 10000000;

  // Auto-fill name when model changes (unless user manually edited)
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    if (!nameManuallyEdited) {
      const model = AI_MODELS[modelId];
      if (model) {
        setName(`${model.name} Portfolio`);
      }
    }
  };

  const handleNameChange = (e) => {
    setName(e.target.value);
    setNameManuallyEdited(true);
  };

  const handleCapitalInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9,]/g, '').replace(/,/g, '');
    if (value === '') {
      setStartingCapital(MIN_CAPITAL);
    } else {
      const numValue = parseInt(value, 10);
      setStartingCapital(Math.max(MIN_CAPITAL, Math.min(MAX_CAPITAL, numValue)));
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a portfolio name');
      return;
    }

    if (startingCapital < MIN_CAPITAL) {
      setError(`Starting capital must be at least ${formatCurrency(MIN_CAPITAL)}`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Call the API to create portfolio and get AI's initial trading decisions
      const response = await fetch('/api/ai-trading/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          name: name.trim(),
          aiModel: selectedModel,
          startingCapital: startingCapital,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize portfolio');
      }

      onCreated(result.portfolio);
      onClose();
      // Reset form
      setName('');
      setNameManuallyEdited(false);
      setSelectedModel('gemini-3-flash-preview');
      setStartingCapital(100000);
    } catch (err) {
      console.error('Error creating portfolio:', err);
      setError(err.message || 'Failed to create portfolio');
    } finally {
      setIsCreating(false);
    }
  };

  // Set initial name on mount
  useEffect(() => {
    if (isOpen && !nameManuallyEdited && !name) {
      const model = AI_MODELS[selectedModel];
      if (model) {
        setName(`${model.name} Portfolio`);
      }
    }
  }, [isOpen]);

  // Reset form when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const selectedModelInfo = AI_MODELS[selectedModel];

  // AI Thinking Loading Component
  const AIThinkingOverlay = () => (
    <div className="absolute inset-0 bg-[var(--color-content-bg)]/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
      {/* Animated brain/thinking graphic */}
      <div className="relative mb-6">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-[var(--color-accent)]/20 animate-ping" style={{ animationDuration: '2s' }} />
        {/* Middle ring */}
        <div className="absolute inset-2 w-20 h-20 rounded-full bg-[var(--color-accent)]/30 animate-pulse" />
        {/* Inner circle with icon */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 border border-[var(--color-accent)]/30 flex items-center justify-center">
          {selectedModelInfo && (
            <selectedModelInfo.icon
              className="w-10 h-10 animate-pulse"
              style={{
                color: selectedModelInfo.color === '#000000' ? 'var(--color-fg)' : selectedModelInfo.color,
                animationDuration: '1.5s'
              }}
            />
          )}
        </div>
      </div>

      {/* Text */}
      <div className="text-center px-6">
        <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">
          AI is thinking...
        </h3>
        <p className="text-sm text-[var(--color-muted)] max-w-xs">
          {selectedModelInfo?.name || 'The AI'} is analyzing the market and making initial investment decisions
        </p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5 mt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--color-accent)]"
            style={{
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={isCreating ? undefined : onClose}
      title="Create AI Portfolio"
      description="Set up a new paper trading simulation"
      size="md"
      footer={
        !isCreating && (
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
              Create Portfolio
            </Button>
          </div>
        )
      }
    >
      <div className="relative h-full">
        {isCreating && <AIThinkingOverlay />}
        <div className={`space-y-6 pt-2 ${isCreating ? 'opacity-0' : ''}`}>
          {/* Portfolio Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              Portfolio Name
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g., My Claude Portfolio"
              className="w-full px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Starting Capital */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              Starting Capital
            </label>
            {/* Preset Options */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[25000, 50000, 100000, 250000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setStartingCapital(amount)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${startingCapital === amount
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)]/50'
                    }`}
                >
                  ${amount >= 1000000 ? `${amount / 1000000}M` : `${amount / 1000}K`}
                </button>
              ))}
            </div>
            {/* Custom Amount Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">$</span>
              <input
                type="text"
                value={startingCapital.toLocaleString()}
                onChange={handleCapitalInputChange}
                className="w-full pl-7 pr-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50 focus:border-[var(--color-accent)] tabular-nums"
              />
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-1.5">
              Simulated paper money for trading
            </p>
          </div>

          {/* AI Model Selection - Grouped by Provider */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-2">
              AI Model
            </label>
            <div className="space-y-4">
              {AI_PROVIDERS.map((provider) => {
                const ProviderIcon = provider.icon;
                return (
                  <div key={provider.id}>
                    {/* Provider Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <ProviderIcon
                        className="w-3.5 h-3.5"
                        style={{ color: provider.color === '#000000' ? 'var(--color-fg)' : provider.color }}
                      />
                      <span className="text-xs font-medium text-[var(--color-muted)]">
                        {provider.name}
                      </span>
                    </div>
                    {/* Models List */}
                    <div className="space-y-1.5">
                      {provider.models.map((model) => {
                        const isSelected = selectedModel === model.id;
                        const isDisabled = model.disabled;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => !isDisabled && handleModelSelect(model.id)}
                            disabled={isDisabled}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isDisabled
                              ? 'border-[var(--color-border)] opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface)]'
                              }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-[var(--color-fg)]">{model.name}</p>
                                {isDisabled && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-muted)]">
                                    Coming soon
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--color-muted)]">{model.description}</p>
                            </div>
                            {isSelected && !isDisabled && (
                              <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0 ml-3">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export default function InvestmentsPage() {
  const { profile } = useUser();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, portfolio: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchPortfolios();
    }
  }, [profile?.id]);

  const fetchPortfolios = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_portfolios')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPortfolios(data || []);
    } catch (err) {
      console.error('Error fetching portfolios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioCreated = (newPortfolio) => {
    setPortfolios(prev => [newPortfolio, ...prev]);
  };

  const handleDeleteClick = (portfolio) => {
    setDeleteModal({ isOpen: true, portfolio });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.portfolio) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ai_portfolios')
        .delete()
        .eq('id', deleteModal.portfolio.id);

      if (error) throw error;
      setPortfolios(prev => prev.filter(p => p.id !== deleteModal.portfolio.id));
      setDeleteModal({ isOpen: false, portfolio: null });
    } catch (err) {
      console.error('Error deleting portfolio:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title="Investments">
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)] mx-auto mb-4" />
            <p className="text-[var(--color-muted)]">Loading portfolios...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const hasPortfolios = portfolios.length > 0;

  // Animation variants for slide transitions
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  // Direction: 1 = forward (to detail), -1 = back (to list)
  const direction = selectedPortfolio ? 1 : -1;

  return (
    <PageContainer title="Investments">
      <AnimatePresence mode="wait" custom={direction}>
        {selectedPortfolio ? (
          <motion.div
            key="detail"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
            className="space-y-6"
          >
            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => setSelectedPortfolio(null)}
                  className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
                >
                  Portfolios
                </button>
                <LuChevronRight className="w-3.5 h-3.5 text-[var(--color-border)]" />
                <span className="text-[var(--color-fg)] font-medium">{selectedPortfolio.name}</span>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-all cursor-pointer"
                title="Portfolio Settings"
              >
                <LuSettings className="w-4 h-4" />
              </button>
            </div>

            {/* Portfolio Detail View */}
            <PortfolioDetailView
              portfolio={selectedPortfolio}
              onClose={() => setSelectedPortfolio(null)}
              onDeleteClick={(deletedPortfolio) => {
                setPortfolios(prev => prev.filter(p => p.id !== deletedPortfolio.id));
                setSelectedPortfolio(null);
              }}
              showSettings={showSettings}
              onCloseSettings={() => setShowSettings(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            custom={direction}
            variants={slideVariants}
            initial={false}
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
            className="space-y-6"
          >
            {/* Header with Create Button */}
            {hasPortfolios && (
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-[var(--color-fg)]">AI Trading Portfolios</h2>
                  <p className="text-sm text-[var(--color-muted)]">
                    Watch AI models compete in paper trading simulations
                  </p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <LuPlus className="w-4 h-4" />
                  New Portfolio
                </Button>
              </div>
            )}

            {hasPortfolios ? (
              /* Portfolio Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {portfolios.map(portfolio => (
                  <PortfolioCard
                    key={portfolio.id}
                    portfolio={portfolio}
                    onDeleteClick={handleDeleteClick}
                    onCardClick={() => setSelectedPortfolio(portfolio)}
                  />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-24 bg-[var(--color-surface)]/30 rounded-lg border border-[var(--color-border)]/50 border-dashed">
                <div className="mx-auto w-20 h-20 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[var(--color-border)]">
                  <LuBot className="h-10 w-10 text-[var(--color-muted)]" />
                </div>
                <h3 className="text-xl font-medium text-[var(--color-fg)] mb-2">
                  No AI portfolios yet
                </h3>
                <p className="text-[var(--color-muted)] mb-8 max-w-md mx-auto">
                  Create your first AI trading portfolio and watch different AI models compete in paper trading simulations.
                </p>
                <Button size="lg" onClick={() => setShowCreateModal(true)}>
                  <LuPlus className="w-4 h-4 mr-2" />
                  Create Your First Portfolio
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CreatePortfolioDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handlePortfolioCreated}
      />

      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, portfolio: null })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteModal.portfolio?.name || 'Portfolio'}`}
        description="This will permanently delete this portfolio and all its trading history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        busy={isDeleting}
        busyLabel="Deleting..."
      />
    </PageContainer>
  );
}

