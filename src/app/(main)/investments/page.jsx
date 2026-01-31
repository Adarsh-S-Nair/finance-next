"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import PlaidLinkModal from "../../../components/PlaidLinkModal";
import { PiBankFill } from "react-icons/pi";
import { useUser } from "../../../components/UserProvider";
import { supabase } from "../../../lib/supabaseClient";
import LineChart from "../../../components/ui/LineChart";
import { useInvestmentsHeader } from "./InvestmentsHeaderContext";
import { ChartSkeleton, CardSkeleton } from "../../../components/ui/Skeleton";

// Format currency with appropriate decimal places
// Uses more decimals for small amounts (crypto prices)
const formatCurrency = (amount) => {
  const absAmount = Math.abs(amount);
  let maxDecimals = 2;
  
  // Use more decimals for small amounts
  if (absAmount > 0 && absAmount < 0.01) {
    maxDecimals = 6;
  } else if (absAmount < 1) {
    maxDecimals = 4;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(amount);
};

// Format shares/quantity with appropriate decimal places
// Shows more decimals for small quantities (common in crypto)
const formatShares = (shares) => {
  const absShares = Math.abs(shares);
  
  if (absShares === 0) return '0';
  if (absShares >= 1) return shares.toFixed(2);
  if (absShares >= 0.01) return shares.toFixed(4);
  if (absShares >= 0.0001) return shares.toFixed(6);
  return shares.toFixed(8);
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

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function InvestmentsPage() {
  const { profile } = useUser();
  const { setHeaderActions } = useInvestmentsHeader();
  const [investmentPortfolios, setInvestmentPortfolios] = useState([]);
  const [allHoldings, setAllHoldings] = useState([]);
  const [stockQuotes, setStockQuotes] = useState({});
  const [portfolioSnapshots, setPortfolioSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [chartTimeRange, setChartTimeRange] = useState('ALL');
  const [sparklineData, setSparklineData] = useState({});

  // Register header actions with layout
  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions({
        onConnectClick: () => setShowLinkModal(true),
      });
    }
  }, [setHeaderActions]);

  // Fetch investment portfolios and holdings
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: plaidPortfoliosData, error: plaidPortfoliosError } = await supabase
          .from('portfolios')
          .select(`
            *,
            holdings(id, ticker, shares, avg_cost),
            source_account:accounts!portfolios_source_account_id_fkey(
              id,
              name,
              balances,
              institutions(name, logo)
            )
          `)
          .eq('user_id', profile.id)
          .eq('type', 'plaid_investment')
          .order('created_at', { ascending: false });

        if (plaidPortfoliosError) throw plaidPortfoliosError;

        setInvestmentPortfolios(plaidPortfoliosData || []);

        const accountIds = (plaidPortfoliosData || [])
          .map(p => p.source_account?.id)
          .filter(id => id);

        if (accountIds.length > 0) {
          const { data: accountSnapshotsData } = await supabase
            .from('account_snapshots')
            .select('*')
            .in('account_id', accountIds)
            .order('recorded_at', { ascending: true });

          setPortfolioSnapshots(accountSnapshotsData || []);
        }

        const allTickers = (plaidPortfoliosData || []).flatMap(p =>
          (p.holdings || []).map(h => h.ticker.toUpperCase())
        );

        const uniqueTickers = [...new Set(allTickers)];

        // Initialize quotes map outside the if block so it's accessible later
        const quotesMap = {};

        if (uniqueTickers.length > 0) {
          // Fetch ticker metadata (logos, names, sectors, asset_type) from our DB
          const { data: tickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector, asset_type')
            .in('symbol', uniqueTickers);

          const tickerMap = {};
          (tickersData || []).forEach(t => {
            tickerMap[t.symbol] = t;
          });

          // Populate quotes map with ticker metadata
          uniqueTickers.forEach(ticker => {
            quotesMap[ticker] = {
              price: null,
              logo: tickerMap[ticker]?.logo || null,
              name: tickerMap[ticker]?.name || null,
              sector: tickerMap[ticker]?.sector || null,
              assetType: tickerMap[ticker]?.asset_type || 'stock',
            };
          });

          // Fetch current prices from the quotes API
          try {
            const quoteResponse = await fetch(`/api/market-data/quotes?tickers=${uniqueTickers.join(',')}`);
            if (quoteResponse.ok) {
              const quoteData = await quoteResponse.json();
              // quoteData.quotes is an object: { AAPL: { price, cached, cachedAt }, ... }
              Object.entries(quoteData.quotes || {}).forEach(([symbol, data]) => {
                if (quotesMap[symbol]) {
                  quotesMap[symbol].price = data.price;
                }
              });
            }
          } catch (err) {
            console.error('Error fetching quotes:', err);
          }

          setStockQuotes(quotesMap);
        }

        // Combine holdings from all portfolios, filtering out cash holdings
        const combinedHoldings = [];
        (plaidPortfoliosData || []).forEach(portfolio => {
          (portfolio.holdings || []).forEach(h => {
            const ticker = (h.ticker || '').toUpperCase();
            const assetType = h.asset_type || quotesMap[ticker]?.assetType || 'stock';
            // Filter out cash holdings - they belong in the allocation section, not holdings display
            const isCashHolding = assetType === 'cash' || ticker.startsWith('CUR:') || ticker === 'USD';
            if (!isCashHolding) {
              combinedHoldings.push({
                ...h,
                portfolioId: portfolio.id,
                portfolioName: portfolio.name,
                assetType: assetType
              });
            }
          });
        });
        setAllHoldings(combinedHoldings);

      } catch (err) {
        console.error('Error fetching investment data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id, refreshTrigger]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    if (!investmentPortfolios.length) {
      return {
        totalHoldingsValue: 0,
        cash: 0,
        totalPortfolioValue: 0,
        cashPercentage: 0,
        holdingsWithValues: [],
        assetTypeTotals: {
          stock: 0,
          crypto: 0,
          cash: 0
        }
      };
    }

    const holdingsWithValues = [];
    let totalHoldingsValue = 0;
    const assetTypeTotals = {
      stock: 0,
      crypto: 0,
      cash: 0
    };

    investmentPortfolios.forEach(portfolio => {
      // Process each holding in this portfolio
      (portfolio.holdings || []).forEach(h => {
        const ticker = (h.ticker || '').toUpperCase();
        const quote = stockQuotes[ticker];
        const shares = h.shares || 0;
        const avgCost = h.avg_cost || 0;
        const assetType = h.asset_type || quote?.assetType || 'stock';
        
        // Check if this is a cash holding
        const isCashHolding = assetType === 'cash' || ticker.startsWith('CUR:') || ticker === 'USD';
        
        if (isCashHolding) {
          // Cash holdings: the value IS the cash amount (price is always 1.0)
          const cashValue = shares * 1.0; // shares represents the dollar amount
          assetTypeTotals.cash += cashValue;
        } else {
          // Non-cash holdings: calculate value at current market price
          const currentPrice = quote?.price || null;
          const priceForCalc = currentPrice !== null ? currentPrice : avgCost;
          const value = shares * priceForCalc;
          
          totalHoldingsValue += value;
          
          // Add to asset type totals
          if (assetType === 'crypto') {
            assetTypeTotals.crypto += value;
          } else {
            // Default to stock for any non-crypto, non-cash asset
            assetTypeTotals.stock += value;
          }

          const existing = holdingsWithValues.find(hv => hv.ticker === ticker);
          if (existing) {
            existing.shares += shares;
            existing.value += value;
            // Weight average cost when combining
            const totalShares = existing.shares;
            existing.avgCost = ((existing.avgCost * (totalShares - shares)) + (avgCost * shares)) / totalShares;
          } else {
            holdingsWithValues.push({
              ticker,
              shares,
              avgCost,
              currentPrice,
              value,
              logo: quote?.logo || null,
              name: quote?.name || null,
              sector: quote?.sector || null,
              assetType
            });
          }
        }
      });
    });

    const cash = assetTypeTotals.cash;
    const totalPortfolioValue = assetTypeTotals.stock + assetTypeTotals.crypto + assetTypeTotals.cash;
    const cashPercentage = totalPortfolioValue > 0 ? (cash / totalPortfolioValue) * 100 : 0;

    holdingsWithValues.sort((a, b) => b.value - a.value);

    return {
      totalHoldingsValue,
      cash,
      totalPortfolioValue,
      cashPercentage,
      holdingsWithValues,
      assetTypeTotals
    };
  }, [investmentPortfolios, stockQuotes]);

  // Fetch sparkline data for holdings
  useEffect(() => {
    const tickers = portfolioMetrics.holdingsWithValues.map(h => h.ticker);
    if (tickers.length === 0) return;

    const fetchSparklineData = async () => {
      const now = new Date();
      let startDate = new Date();
      
      // Calculate start date based on time range
      switch (chartTimeRange) {
        case '1W': startDate.setDate(now.getDate() - 7); break;
        case '1M': startDate.setMonth(now.getMonth() - 1); break;
        case '3M': startDate.setMonth(now.getMonth() - 3); break;
        case 'YTD': startDate = new Date(now.getFullYear(), 0, 1); break;
        case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
        case 'ALL': startDate.setFullYear(now.getFullYear() - 5); break;
        default: startDate.setMonth(now.getMonth() - 1);
      }

      const startTs = Math.floor(startDate.getTime() / 1000);
      const endTs = Math.floor(now.getTime() / 1000);
      const sparklines = {};

      // Fetch sparkline data for each ticker
      await Promise.all(tickers.map(async (ticker) => {
        try {
          const response = await fetch(
            `/api/market-data/historical-range?ticker=${ticker}&start=${startTs}&end=${endTs}&interval=1d`
          );
          if (response.ok) {
            const data = await response.json();
            // Extract just the prices for the sparkline
            sparklines[ticker] = (data.prices || []).map(p => p.price);
          }
        } catch (err) {
          console.error(`Error fetching sparkline for ${ticker}:`, err);
        }
      }));

      setSparklineData(sparklines);
    };

    fetchSparklineData();
  }, [portfolioMetrics.holdingsWithValues, chartTimeRange]);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/3 flex flex-col gap-6">
          <ChartSkeleton />
        </div>
        <div className="lg:w-1/3 flex flex-col gap-4">
          <CardSkeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <>
      {investmentPortfolios.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Panel - 2/3 width */}
          <div className="lg:w-2/3 flex flex-col gap-6">
            <PortfolioChartCard
              portfolioMetrics={portfolioMetrics}
              snapshots={portfolioSnapshots}
              holdings={portfolioMetrics.holdingsWithValues}
              timeRange={chartTimeRange}
              onTimeRangeChange={setChartTimeRange}
            />

            {/* Holdings List */}
            <HoldingsList
              holdings={portfolioMetrics.holdingsWithValues}
              sparklineData={sparklineData}
            />
          </div>

          {/* Side Panel - 1/3 width */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            <AccountsSummary
              portfolioMetrics={portfolioMetrics}
              accounts={investmentPortfolios}
              stockQuotes={stockQuotes}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-[var(--color-surface)]/30 rounded-xl border border-[var(--color-border)]/50 border-dashed">
          <div className="mx-auto w-16 h-16 bg-[var(--color-surface)] rounded-full flex items-center justify-center mb-4 border border-[var(--color-border)]">
            <PiBankFill className="h-8 w-8 text-[var(--color-muted)]" />
          </div>
          <p className="text-[var(--color-fg)] font-medium mb-2">No investment accounts connected</p>
          <p className="text-sm text-[var(--color-muted)] mb-6 max-w-sm mx-auto">
            Connect your brokerage accounts to see your portfolio and holdings here.
          </p>
          <Button onClick={() => setShowLinkModal(true)}>
            Connect Account
          </Button>
        </div>
      )}

      <PlaidLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        defaultAccountType="investment"
        onSuccess={() => {
          setRefreshTrigger(prev => prev + 1);
        }}
      />
    </>
  );
}

// ============================================================================
// PORTFOLIO CHART CARD - Clean minimal design with historical price interpolation
// ============================================================================

function PortfolioChartCard({ portfolioMetrics, snapshots, holdings, timeRange, onTimeRangeChange }) {
  const { profile } = useUser();
  const totalValue = portfolioMetrics.totalPortfolioValue;
  const cashValue = portfolioMetrics.cash;
  const setTimeRange = onTimeRangeChange;
  const [activeIndex, setActiveIndex] = useState(null);
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Get the oldest snapshot date as the starting point for charts
  // This limits "ALL" to only go back to when we have data
  const oldestSnapshotDate = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      // If no snapshots, use today (charts will show flat line)
      return new Date();
    }
    const dates = snapshots.map(s => new Date(s.recorded_at));
    return new Date(Math.min(...dates));
  }, [snapshots]);

  // Calculate the date range based on time range selection
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate = new Date(oldestSnapshotDate);

    switch (timeRange) {
      case '1W': 
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7); 
        break;
      case '1M': 
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1); 
        break;
      case '3M': 
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3); 
        break;
      case 'YTD': 
        startDate = new Date(now.getFullYear(), 0, 1); 
        break;
      case '1Y': 
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1); 
        break;
      default: // 'ALL'
        startDate = new Date(oldestSnapshotDate);
    }

    // If start date is before oldest snapshot, use oldest snapshot
    if (startDate < oldestSnapshotDate) {
      startDate = new Date(oldestSnapshotDate);
    }

    return { startDate, endDate: now };
  }, [timeRange, oldestSnapshotDate]);

  // Get unique tickers from holdings
  const tickers = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    return [...new Set(holdings.map(h => h.ticker))];
  }, [holdings]);

  // Determine the appropriate interval based on time range
  const { interval, maxPoints } = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    
    // Choose interval to get ~40 data points
    // Yahoo Finance limits: 1m (7 days), 5m/15m/30m/1h (60 days), 1d (unlimited)
    if (diffDays <= 2) {
      // Less than 2 days: use 1-hour interval
      return { interval: '1h', maxPoints: 40 };
    } else if (diffDays <= 7) {
      // 2-7 days: use 1-hour interval
      return { interval: '1h', maxPoints: 40 };
    } else if (diffDays <= 60) {
      // 1 week to 2 months: use 1-hour interval (will get more points, we'll sample)
      return { interval: '1h', maxPoints: 40 };
    } else {
      // More than 2 months: use daily interval
      return { interval: '1d', maxPoints: 40 };
    }
  }, [dateRange]);

  // Fetch historical prices for all tickers using range API
  useEffect(() => {
    if (tickers.length === 0) return;

    const fetchHistoricalPrices = async () => {
      setIsLoadingPrices(true);
      const pricesMap = {};

      try {
        const { startDate, endDate } = dateRange;
        const startTs = Math.floor(startDate.getTime() / 1000);
        const endTs = Math.floor(endDate.getTime() / 1000);

        // Fetch prices for each ticker in parallel using the range API
        const promises = tickers.map(async (ticker) => {
          try {
            const response = await fetch(
              `/api/market-data/historical-range?ticker=${ticker}&start=${startTs}&end=${endTs}&interval=${interval}`
            );
            if (response.ok) {
              const data = await response.json();
              return { ticker, prices: data.prices || [] };
            }
          } catch (err) {
            console.error(`Error fetching historical prices for ${ticker}:`, err);
          }
          return { ticker, prices: [] };
        });

        const results = await Promise.all(promises);
        results.forEach(({ ticker, prices }) => {
          pricesMap[ticker] = prices;
        });

        setHistoricalPrices(pricesMap);
      } catch (err) {
        console.error('Error fetching historical prices:', err);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchHistoricalPrices();
  }, [tickers, dateRange, interval]);

  // Generate 39 evenly spaced historical timestamps + 1 current timestamp for the chart
  const chartTimestamps = useMemo(() => {
    const { startDate, endDate } = dateRange;
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    const diffMs = endTs - startTs;
    
    // Generate 59 historical points, the 60th will be "now" with current value
    const HISTORICAL_POINTS = 59;
    const timestamps = [];
    
    for (let i = 0; i < HISTORICAL_POINTS; i++) {
      const ts = startTs + (diffMs * i / HISTORICAL_POINTS);
      timestamps.push(Math.floor(ts / 1000)); // Unix timestamp in seconds
    }
    
    // Add current timestamp as the last point
    const nowTs = Math.floor(Date.now() / 1000);
    timestamps.push(nowTs);
    
    console.log(`[Chart] Generated ${timestamps.length} timestamps from ${new Date(timestamps[0] * 1000).toISOString()} to ${new Date(timestamps[timestamps.length - 1] * 1000).toISOString()}`);
    return timestamps;
  }, [dateRange]);

  // Helper to find the closest price for a given timestamp
  const findPriceAtTimestamp = (pricesArray, targetTs) => {
    if (!pricesArray || pricesArray.length === 0) return null;
    
    // Find the closest price at or before the target timestamp
    let closest = null;
    for (const item of pricesArray) {
      if (item.timestamp <= targetTs) {
        closest = item.price;
      } else {
        break; // Array is sorted, no need to continue
      }
    }
    
    // If no price found before target, use the first available price
    if (closest === null && pricesArray.length > 0) {
      closest = pricesArray[0].price;
    }
    
    return closest;
  };

  // Calculate chart data based on historical prices
  const displayChartData = useMemo(() => {
    if (chartTimestamps.length === 0) return [];

    const diffDays = (dateRange.endDate - dateRange.startDate) / (24 * 60 * 60 * 1000);
    const isShortRange = diffDays <= 7;

    // Helper to format date string
    const formatDate = (date) => {
      if (isShortRange) {
        return date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
      }
    };

    // If no holdings, just show a flat line at total value
    if (!holdings || holdings.length === 0) {
      return chartTimestamps.map(ts => {
        const date = new Date(ts * 1000);
        return {
          timestamp: ts,
          dateString: formatDate(date),
          date,
          value: totalValue
        };
      });
    }

    // Calculate portfolio value for each timestamp (first 39 points)
    const chartData = chartTimestamps.slice(0, -1).map((ts) => {
      let portfolioValue = cashValue; // Start with cash
      const date = new Date(ts * 1000);

      holdings.forEach(holding => {
        const ticker = holding.ticker;
        const shares = holding.shares;
        const tickerPrices = historicalPrices[ticker] || [];
        
        // Get the price for this timestamp
        let price = findPriceAtTimestamp(tickerPrices, ts);
        
        // Fallback to current price or avg cost if no historical price found
        if (price === null) {
          price = holding.currentPrice || holding.avgCost || 0;
        }

        portfolioValue += shares * price;
      });

      return {
        timestamp: ts,
        dateString: formatDate(date),
        date,
        value: portfolioValue
      };
    });

    // Add the current portfolio value as the final (40th) data point
    const now = new Date();
    chartData.push({
      timestamp: Math.floor(now.getTime() / 1000),
      dateString: formatDate(now),
      date: now,
      value: totalValue // Use the actual current portfolio value
    });

    return chartData;
  }, [chartTimestamps, holdings, historicalPrices, cashValue, totalValue, dateRange]);

  // Log chart data for debugging
  useEffect(() => {
    if (displayChartData.length > 0) {
      console.log(`[Chart] Generated ${displayChartData.length} data points:`, 
        displayChartData.slice(0, 3).map(d => `${d.dateString}: $${d.value.toFixed(2)}`).join(', '),
        '...',
        displayChartData.slice(-1).map(d => `${d.dateString}: $${d.value.toFixed(2)}`).join('')
      );
    }
  }, [displayChartData]);

  // Calculate chart color and percent change
  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return 'var(--color-success)';
    return displayChartData[displayChartData.length - 1].value >= displayChartData[0].value
      ? 'var(--color-success)'
      : 'var(--color-danger)';
  }, [displayChartData]);

  // When hovering, show hovered data point; otherwise show the last data point (current value)
  const displayData = activeIndex !== null && displayChartData[activeIndex]
    ? displayChartData[activeIndex]
    : displayChartData[displayChartData.length - 1] || { value: totalValue, dateString: 'Now', date: new Date() };

  const startValue = displayChartData[0]?.value || totalValue;
  const percentChange = startValue > 0
    ? ((displayData.value - startValue) / startValue) * 100
    : 0;
  const returnAmount = displayData.value - startValue;

  // Always show all time range options
  const availableRanges = ['1W', '1M', '3M', 'YTD', '1Y', 'ALL'];

  const handleMouseMove = (data, index) => {
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const activeTextColor = isDarkMode ? 'var(--color-on-accent)' : '#fff';

  return (
    <Card variant="glass" padding="none">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">
              Portfolio Value
            </div>
            <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight">
              <AnimatedCounter value={displayData.value} />
            </div>
            <div className={`text-xs font-medium mt-0.5 ${percentChange > 0 ? 'text-emerald-500' : percentChange < 0 ? 'text-rose-500' : 'text-[var(--color-muted)]'}`}>
              {returnAmount >= 0 ? '+' : ''}{formatCurrency(returnAmount)}
              {' '}({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)
            </div>
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            {displayData?.dateString || 'Today'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="pt-4 pb-2 relative">
        {isLoadingPrices && (
          <div className="absolute top-6 right-6 z-10">
            <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {displayChartData.length > 0 ? (
          <div
            className="w-full focus:outline-none relative"
            tabIndex={-1}
            style={{ height: '200px' }}
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
              areaOpacity={0.35}
              showDots={false}
              dotRadius={5}
              dotColor={chartColor}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              showTooltip={false}
              gradientId="portfolioChartGradient"
              curveType="monotone"
              animationDuration={800}
              xAxisDataKey="dateString"
              yAxisDomain={['dataMin', 'dataMax']}
            />
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-[var(--color-muted)] text-sm">
            No chart data available
          </div>
        )}
      </div>

      {/* Time Range Selector */}
      <div className="mt-2 pt-2 px-6 pb-4 border-t border-[var(--color-border)]/50">
        <div className="flex justify-between items-center w-full">
          {availableRanges.map((range) => {
            const isActive = timeRange === range;
            return (
              <div key={range} className="flex-1 flex justify-center">
                <button
                  onClick={() => setTimeRange(range)}
                  className="relative px-3 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none"
                  style={{ color: isActive ? activeTextColor : 'var(--color-muted)' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="portfolioTimeRange"
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
  );
}

// ============================================================================
// HOLDINGS LIST - Clean list like accounts page
// ============================================================================

// Mini sparkline component
function MiniSparkline({ data, width = 80, height = 24, maxPoints = 20 }) {
  if (!data || data.length < 2) return null;

  // Sample data if it has too many points
  let sampledData = data;
  if (data.length > maxPoints) {
    const step = (data.length - 1) / (maxPoints - 1);
    sampledData = [];
    for (let i = 0; i < maxPoints; i++) {
      const index = Math.round(i * step);
      sampledData.push(data[index]);
    }
  }

  const min = Math.min(...sampledData);
  const max = Math.max(...sampledData);
  const range = max - min || 1;
  
  // Determine if trend is up or down
  const isUp = sampledData[sampledData.length - 1] >= sampledData[0];
  const color = isUp ? '#10b981' : '#f43f5e'; // emerald-500 / rose-500

  // Create SVG path with smooth curves
  const points = sampledData.map((value, i) => {
    const x = (i / (sampledData.length - 1)) * width;
    const y = height - 2 - ((value - min) / range) * (height - 4); // Add padding
    return { x, y };
  });

  // Create smooth curve using quadratic bezier
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    pathD += ` Q ${prev.x},${prev.y} ${midX},${(prev.y + curr.y) / 2}`;
  }
  // Connect to last point
  const last = points[points.length - 1];
  pathD += ` L ${last.x},${last.y}`;

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Single holding row component
function HoldingRow({ holding, sparkline, showBorder = true }) {
  const currentPrice = holding.currentPrice;
  const value = holding.value;
  const isCrypto = holding.assetType === 'crypto';
  
  // Calculate gain/loss based on the time period (sparkline start vs current)
  let gainPercent = null;
  let gainAmount = null;
  
  if (sparkline && sparkline.length >= 2 && currentPrice !== null) {
    const startPrice = sparkline[0];
    if (startPrice > 0) {
      gainPercent = ((currentPrice - startPrice) / startPrice) * 100;
      gainAmount = (currentPrice - startPrice) * holding.shares;
    }
  }

  return (
    <div
      className={`grid grid-cols-[1fr_90px_140px] items-center gap-6 px-4 py-3 hover:bg-[var(--color-surface)]/20 transition-colors ${showBorder ? 'border-b border-white/5 dark:border-white/[0.02] last:border-b-0' : ''}`}
    >
      {/* Left section: Logo + ticker info */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            background: holding.logo ? 'transparent' : 'var(--color-surface)',
            border: '1px solid var(--color-border)'
          }}
        >
          {holding.logo ? (
            <img src={holding.logo} alt={holding.ticker} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-medium text-[var(--color-muted)]">
              {holding.ticker.slice(0, 2)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[var(--color-fg)]">{holding.ticker}</span>
            {holding.name && (
              <span className="text-xs text-[var(--color-muted)] truncate max-w-[100px]">{holding.name}</span>
            )}
          </div>
          <div className="text-xs text-[var(--color-muted)]">
            {formatShares(holding.shares)} {isCrypto ? 'coins' : 'shares'} {currentPrice !== null && `@ ${formatCurrency(currentPrice)}`}
          </div>
        </div>
      </div>

      {/* Sparkline column - fixed width, centered */}
      <div className="flex items-center justify-center">
        <MiniSparkline data={sparkline} width={70} height={24} maxPoints={20} />
      </div>

      {/* Right section: Value + gain - fixed width, right-aligned */}
      <div className="text-right">
        <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
          {formatCurrency(value)}
        </div>
        {gainPercent !== null ? (
          <div className={`text-xs tabular-nums whitespace-nowrap ${Math.abs(gainPercent) < 0.005 ? 'text-[var(--color-muted)]' : gainPercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {gainAmount >= 0 ? '+' : ''}{formatCurrency(gainAmount)} ({gainPercent > 0.005 ? '+' : ''}{gainPercent.toFixed(2)}%)
          </div>
        ) : (
          <div className="text-xs text-[var(--color-muted)]">-</div>
        )}
      </div>
    </div>
  );
}

function HoldingsList({ holdings, sparklineData = {} }) {
  if (!holdings || holdings.length === 0) return null;

  // Separate stocks and crypto
  const stocks = holdings.filter(h => h.assetType !== 'crypto');
  const crypto = holdings.filter(h => h.assetType === 'crypto');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-1 flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider">
          Holdings
        </h2>
        <span className="text-xs text-[var(--color-muted)]">
          {holdings.length} {holdings.length === 1 ? 'position' : 'positions'}
        </span>
      </div>

      {/* Single container for all holdings */}
      <div className="glass-panel rounded-xl overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none border border-white/5 dark:border-white/[0.02] rounded-xl" />
        {/* Stocks Section */}
        {stocks.length > 0 && (
          <>
            <div className="px-4 py-2.5 border-b border-white/5 dark:border-white/[0.02] relative z-10">
              <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                Stocks
              </div>
            </div>
            <div className="relative z-10">
              {stocks.map((holding) => (
                <HoldingRow 
                  key={holding.ticker} 
                  holding={holding} 
                  sparkline={sparklineData[holding.ticker]}
                />
              ))}
            </div>
          </>
        )}

        {/* Crypto Section */}
        {crypto.length > 0 && (
          <>
            {stocks.length > 0 && (
              <div className="border-t border-white/5 dark:border-white/[0.02] relative z-10" />
            )}
            <div className="px-4 py-2.5 border-b border-white/5 dark:border-white/[0.02] relative z-10">
              <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                Crypto
              </div>
            </div>
            <div className="relative z-10">
              {crypto.map((holding) => (
                <HoldingRow 
                  key={holding.ticker} 
                  holding={holding} 
                  sparkline={sparklineData[holding.ticker]}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNTS SUMMARY - Minimal design
// ============================================================================

function AccountsSummary({ portfolioMetrics, accounts, stockQuotes }) {
  // Calculate invested percent (non-cash assets)
  const nonCashValue = (portfolioMetrics.assetTypeTotals?.stock || 0) + (portfolioMetrics.assetTypeTotals?.crypto || 0);
  const investedPercent = portfolioMetrics.totalPortfolioValue > 0
    ? ((nonCashValue / portfolioMetrics.totalPortfolioValue) * 100)
    : 0;

  // Calculate each account's value and group by institution
  const accountsByInstitution = useMemo(() => {
    const grouped = {};
    
    accounts.forEach(portfolio => {
      const account = portfolio.source_account;
      const institution = account?.institutions;
      const institutionName = institution?.name || 'Other';
      const institutionLogo = institution?.logo || null;
      const accountName = account?.name || 'Account';

      // Calculate holdings value and cash from actual holdings
      let holdingsValue = 0;
      let cashValue = 0;
      
      (portfolio.holdings || []).forEach(h => {
        const ticker = (h.ticker || '').toUpperCase();
        const quote = stockQuotes[ticker];
        const shares = h.shares || 0;
        const assetType = h.asset_type || quote?.assetType || 'stock';
        
        const isCashHolding = assetType === 'cash' || ticker.startsWith('CUR:') || ticker === 'USD';
        
        if (isCashHolding) {
          cashValue += shares * 1.0;
        } else {
          const price = quote?.price || h.avg_cost || 0;
          holdingsValue += shares * price;
        }
      });

      const totalValue = holdingsValue + cashValue;

      if (!grouped[institutionName]) {
        grouped[institutionName] = {
          name: institutionName,
          logo: institutionLogo,
          accounts: [],
          totalValue: 0
        };
      }
      
      grouped[institutionName].accounts.push({
        id: portfolio.id,
        name: accountName,
        totalValue
      });
      grouped[institutionName].totalValue += totalValue;
    });

    // Sort institutions by total value (descending)
    return Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
  }, [accounts, stockQuotes]);

  const cashPercent = 100 - investedPercent;
  const totalValue = portfolioMetrics.totalPortfolioValue;
  
  // Create segments for the segmented bar grouped by asset type
  const segments = [
    {
      label: 'Stocks',
      amount: portfolioMetrics.assetTypeTotals?.stock || 0,
      color: 'var(--color-neon-green)' // Use neon-green like Investments in accounts page
    },
    {
      label: 'Crypto',
      amount: portfolioMetrics.assetTypeTotals?.crypto || 0,
      color: '#f59e0b' // Amber-500 for crypto
    },
    {
      label: 'Cash',
      amount: portfolioMetrics.assetTypeTotals?.cash || 0,
      color: '#059669' // Emerald-600 like Cash in accounts page
    }
  ].filter(segment => segment.amount > 0);

  const [hoveredSegment, setHoveredSegment] = useState(null);

  return (
    <Card variant="glass" padding="none">
      {/* Allocation Bar */}
      <div className="p-5 pb-4">
        <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Allocation
        </div>
        
        {/* Segmented Bar */}
        {totalValue > 0 ? (
          <div className="space-y-4">
            {/* Bar */}
            <div
              className="w-full h-3 flex rounded-full overflow-hidden bg-[var(--color-surface)]"
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {segments.map((segment) => {
                const percentage = (segment.amount / totalValue) * 100;
                const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;

                return (
                  <div
                    key={segment.label}
                    className="h-full transition-all duration-200 cursor-pointer"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: segment.color,
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
                const isHovered = hoveredSegment && hoveredSegment.label === segment.label;
                const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;
                const percentage = ((segment.amount / totalValue) * 100).toFixed(1);

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
                        style={{ backgroundColor: segment.color }}
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
        ) : (
          <div className="w-full h-3 bg-[var(--color-border)]/20 rounded-full overflow-hidden" />
        )}
      </div>

      {/* Accounts grouped by institution */}
      {accountsByInstitution.length > 0 && (
        <div className="px-5 pb-5">
          <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-3">
            Linked Accounts
          </div>
          <div className="space-y-4">
            {accountsByInstitution.map((institution, instIndex) => (
              <div key={institution.name}>
                {/* Institution Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {institution.logo ? (
                      <img
                        src={institution.logo}
                        alt=""
                        className="w-4 h-4 rounded object-contain flex-shrink-0"
                      />
                    ) : (
                      <PiBankFill className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
                    )}
                    <span className="text-xs text-[var(--color-muted)]">{institution.name}</span>
                  </div>
                  <span className="text-xs text-[var(--color-fg)] font-medium tabular-nums">
                    {formatCurrency(institution.totalValue)}
                  </span>
                </div>
                
                {/* Accounts under this institution */}
                <div className="ml-6 space-y-1.5">
                  {institution.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-xs text-[var(--color-muted)] truncate pr-2">
                        {account.name}
                      </span>
                      <span className="text-xs text-[var(--color-fg)] font-medium tabular-nums flex-shrink-0">
                        {formatCurrency(account.totalValue)}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Divider between institutions */}
                {instIndex < accountsByInstitution.length - 1 && (
                  <div className="mt-4 border-t border-[var(--color-border)]/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
