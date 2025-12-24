"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageContainer from "../../../components/PageContainer";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Drawer from "../../../components/ui/Drawer";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import LineChart from "../../../components/ui/LineChart";
import CustomDonut from "../../../components/ui/CustomDonut";
import { LuPlus, LuBot, LuTrendingUp, LuTrendingDown, LuTrash2, LuSettings, LuChevronRight, LuWallet, LuCoins, LuClock } from "react-icons/lu";
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

// Format currency with 2 decimal places
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format currency with smaller decimal digits (for display)
const formatCurrencyWithSmallCents = (amount) => {
  const formatted = formatCurrency(amount);
  const parts = formatted.split('.');
  if (parts.length === 2) {
    return (
      <>
        {parts[0]}<span className="text-[0.85em] text-[var(--color-muted)]">.{parts[1]}</span>
      </>
    );
  }
  return formatted;
};

// Format percentage
const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Parse a date string (YYYY-MM-DD) as a local date, not UTC
// This prevents timezone issues where "2025-12-22" becomes "2025-12-21" in local time
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
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
      {formatCurrencyWithSmallCents(displayValue)}
    </span>
  );
}

// Rebalance Countdown Component
function RebalanceCountdown({ nextRebalanceDate, rebalanceCadence }) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const nextDate = new Date(nextRebalanceDate);

      // Set time to end of day for the rebalance date
      nextDate.setHours(23, 59, 59, 999);

      const diff = nextDate - now;

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setProgress(100);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });

      // Calculate progress based on cadence
      let totalDays = 30; // Default to monthly
      if (rebalanceCadence === 'daily') totalDays = 1;
      else if (rebalanceCadence === 'weekly') totalDays = 7;
      else if (rebalanceCadence === 'monthly') totalDays = 30;
      else if (rebalanceCadence === 'quarterly') totalDays = 90;
      else if (rebalanceCadence === 'yearly') totalDays = 365;

      // Calculate how many days have passed since last rebalance (or creation)
      const previousDate = new Date(nextDate);
      previousDate.setDate(previousDate.getDate() - totalDays);
      const elapsed = now - previousDate;
      const total = nextDate - previousDate;
      const progressPercent = Math.min(Math.max((elapsed / total) * 100, 0), 100);

      setProgress(progressPercent);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [nextRebalanceDate, rebalanceCadence]);

  if (!timeRemaining) {
    return (
      <div className="text-sm text-[var(--color-muted)]">Calculating...</div>
    );
  }

  const formatCadence = (cadence) => {
    if (!cadence) return 'Monthly';
    return cadence.charAt(0).toUpperCase() + cadence.slice(1);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-lg font-medium text-[var(--color-fg)] tabular-nums">
        {timeRemaining.days > 0 ? (
          <>{timeRemaining.days}d {timeRemaining.hours}h</>
        ) : timeRemaining.hours > 0 ? (
          <>{timeRemaining.hours}h {timeRemaining.minutes}m</>
        ) : (
          <>{timeRemaining.minutes}m {timeRemaining.seconds}s</>
        )}
      </div>
      <div className="text-right">
        <div className="text-[11px] text-[var(--color-muted)]/60">
          {new Date(nextRebalanceDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })}
        </div>
        <div className="text-[10px] text-[var(--color-muted)]/50">
          {formatCadence(rebalanceCadence)}
        </div>
      </div>
    </div>
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
  const [benchmarkData, setBenchmarkData] = useState({}); // { dateString: price }
  const [showHoldingsDrawer, setShowHoldingsDrawer] = useState(false);
  const [computedAccentColor, setComputedAccentColor] = useState('#00f3ff');

  // Calculate current total value: use latest prices from stockQuotes when available
  const [holdings, setHoldings] = useState([]);
  const [trades, setTrades] = useState([]);
  const currentTotalValue = useMemo(() => {
    const cash = parseFloat(portfolio.current_cash) || 0;

    // Calculate holdings value using current market prices from stockQuotes
    // Fall back to avg_cost if no quote is available
    let holdingsValue = 0;
    if (holdings.length > 0) {
      holdingsValue = holdings.reduce((sum, holding) => {
        const shares = parseFloat(holding.shares) || 0;
        const ticker = holding.ticker.toUpperCase();
        const quote = stockQuotes[ticker];

        // Use current market price if available, otherwise fall back to avg_cost
        const currentPrice = quote?.price || parseFloat(holding.avg_cost) || 0;

        // Log per-holding valuation when quotes are present (for debugging)
        if (quote?.price) {
          console.log('[PortfolioDetailView] Holding valuation', {
            portfolioId: portfolio.id,
            ticker,
            shares,
            price: quote.price,
            value: shares * currentPrice,
          });
        }

        return sum + shares * currentPrice;
      }, 0);
    }

    const total = cash + holdingsValue;
    return total;
  }, [holdings, portfolio.current_cash, stockQuotes, portfolio.id]);


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

        // Fetch QQQ benchmark prices for all snapshot dates
        if (snapshotsData && snapshotsData.length > 0) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const snapshotDates = snapshotsData.map(s => s.snapshot_date);
            const benchmarkPrices = {};

            // Fetch historical closing prices for all snapshot dates (including today if there's a snapshot today)
            // This ensures we use actual closing prices for each date, not current live prices
            if (snapshotDates.length > 0) {
              const historicalRes = await fetch(`/api/market-data/historical?ticker=QQQ&dates=${snapshotDates.join(',')}`);
              if (historicalRes.ok) {
                const historicalResult = await historicalRes.json();
                Object.assign(benchmarkPrices, historicalResult.prices || {});
              }
            }

            // Also fetch current price (postMarket or regularMarket) for today
            // This is used for the "current point" on the chart (live data, separate from snapshots)
            const quotesRes = await fetch(`/api/market-data/quotes?tickers=QQQ`);
            if (quotesRes.ok) {
              const quotesResult = await quotesRes.json();
              const qqqQuote = quotesResult.quotes?.QQQ;
              if (qqqQuote?.price) {
                // Only use current price for today if we don't already have a closing price for today
                // (i.e., if there's no snapshot today, or if we want to show live data)
                if (!benchmarkPrices[today]) {
                  benchmarkPrices[today] = qqqQuote.price;
                }
              }
            }

            // Log all benchmark prices to server for verification
            fetch('/api/debug/benchmark-prices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                portfolioId: portfolio.id,
                ticker: 'QQQ',
                prices: benchmarkPrices,
              }),
            }).catch(() => { });

            setBenchmarkData(benchmarkPrices);
          } catch (benchmarkErr) {
            console.error('Error fetching benchmark data:', benchmarkErr);
          }
        } else {
          // Even if no snapshots, fetch today's QQQ price for initial comparison
          try {
            const today = new Date().toISOString().split('T')[0];
            const quotesRes = await fetch(`/api/market-data/quotes?tickers=QQQ`);
            if (quotesRes.ok) {
              const quotesResult = await quotesRes.json();
              const qqqQuote = quotesResult.quotes?.QQQ;
              if (qqqQuote?.price) {
                setBenchmarkData({ [today]: qqqQuote.price });
              }
            }
          } catch (benchmarkErr) {
            console.error('Error fetching benchmark data:', benchmarkErr);
          }
        }

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

        // Fetch trades
        const { data: tradesData, error: tradesError } = await supabase
          .from('ai_portfolio_trades')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('executed_at', { ascending: false });

        if (tradesError) throw tradesError;

        // Fetch ticker info for trades
        if (tradesData && tradesData.length > 0) {
          const tradeTickers = [...new Set(tradesData.map(t => t.ticker.toUpperCase()))];
          const { data: tradeTickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector')
            .in('symbol', tradeTickers);

          // Create a map of ticker to logo/name/sector
          const tradeTickerMap = new Map();
          if (tradeTickersData) {
            tradeTickersData.forEach(t => {
              tradeTickerMap.set(t.symbol, { logo: t.logo, name: t.name, sector: t.sector });
            });
          }

          // Add logo/name/sector to each trade
          const tradesWithLogos = tradesData.map(trade => ({
            ...trade,
            logo: tradeTickerMap.get(trade.ticker.toUpperCase())?.logo || null,
            companyName: tradeTickerMap.get(trade.ticker.toUpperCase())?.name || null,
            sector: tradeTickerMap.get(trade.ticker.toUpperCase())?.sector || null,
          }));

          setTrades(tradesWithLogos);
        } else {
          setTrades([]);
        }
      } catch (err) {
        console.error('Error fetching portfolio data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolio.id]);

  // Periodically refresh stock quotes to keep portfolio value current (cache in localStorage to survive reloads)
  useEffect(() => {
    if (holdings.length === 0) return;

    const tickers = holdings.map(h => h.ticker.toUpperCase());
    const tickerList = tickers.join(',');
    const cacheKey = `portfolio_quotes_${portfolio.id}`;
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    const loadCachedQuotes = () => {
      if (typeof window === 'undefined') return null;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (!parsed?.timestamp || !parsed?.quotes) return null;
        if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
        return parsed.quotes;
      } catch (err) {
        console.error('Error reading cached quotes:', err);
        return null;
      }
    };

    const persistQuotes = (quotes) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), quotes })
        );
      } catch (err) {
        console.error('Error caching quotes:', err);
      }
    };

    const fetchQuotes = async () => {
      try {
        const quotesRes = await fetch(`/api/market-data/quotes?tickers=${tickerList}`);
        if (quotesRes.ok) {
          const quotesData = await quotesRes.json();
          const quotes = quotesData.quotes || {};
          setStockQuotes(quotes);
          persistQuotes(quotes);
        }
      } catch (quotesErr) {
        console.error('Error fetching stock quotes:', quotesErr);
      }
    };

    // Apply cached quotes immediately if fresh
    const cachedQuotes = loadCachedQuotes();
    if (cachedQuotes) {
      setStockQuotes(cachedQuotes);
    } else {
      fetchQuotes();
    }

    // Refresh every 5 minutes
    const interval = setInterval(fetchQuotes, CACHE_TTL_MS);

    return () => clearInterval(interval);
  }, [holdings, portfolio.id]);

  // Get computed accent color from CSS variable or profile
  useEffect(() => {
    // First, check if user has a custom accent color set in profile
    if (profile?.accent_color && profile.accent_color.startsWith('#')) {
      setComputedAccentColor(profile.accent_color);
      return;
    }

    // Try to get from CSS variable
    if (typeof window !== 'undefined') {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      let hexColor = null;

      if (color && color.startsWith('#')) {
        hexColor = color;
      } else if (color) {
        // If it's RGB or other format, try to use it anyway
        const tempDiv = document.createElement('div');
        tempDiv.style.color = color;
        document.body.appendChild(tempDiv);
        const computedColor = getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);

        // Parse RGB to hex
        const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
          const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
          const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
          hexColor = `#${r}${g}${b}`;
        }
      }

      // Check if the color is too light (likely the white fallback)
      // If so, use a default cyan accent
      if (hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = (r + g + b) / 3;

        // If brightness is too high (> 200), use default cyan
        if (brightness > 200) {
          setComputedAccentColor('#00f3ff'); // Default neon cyan
        } else {
          setComputedAccentColor(hexColor);
        }
      } else {
        setComputedAccentColor('#00f3ff'); // Default neon cyan
      }
    }
  }, [profile?.accent_color]);

  const chartData = useMemo(() => {
    // Normalize benchmark values to start at portfolio's starting capital
    const startingCapital = parseFloat(portfolio.starting_capital) || 100000;
    let firstBenchmarkPrice = null;
    let normalizedBenchmark = {};

    // Find the first benchmark price to use as baseline
    if (snapshots.length > 0 && Object.keys(benchmarkData).length > 0) {
      const firstSnapshotDate = snapshots[0].snapshot_date;
      firstBenchmarkPrice = benchmarkData[firstSnapshotDate];

      // If first snapshot doesn't have benchmark, find the earliest available
      if (!firstBenchmarkPrice) {
        const sortedDates = Object.keys(benchmarkData).sort();
        if (sortedDates.length > 0) {
          firstBenchmarkPrice = benchmarkData[sortedDates[0]];
        }
      }

      // Normalize all benchmark prices relative to starting capital
      if (firstBenchmarkPrice && firstBenchmarkPrice > 0) {
        Object.keys(benchmarkData).forEach(dateStr => {
          const price = benchmarkData[dateStr];
          if (price && price > 0) {
            // Scale benchmark to start at starting capital
            normalizedBenchmark[dateStr] = (price / firstBenchmarkPrice) * startingCapital;
          }
        });
      }
    }

    const data = snapshots.map((snapshot) => {
      const date = parseLocalDate(snapshot.snapshot_date);
      const dateString = snapshot.snapshot_date;
      const benchmarkValue = normalizedBenchmark[dateString] || null;

      return {
        month: date.toLocaleString('en-US', { month: 'short' }),
        monthFull: date.toLocaleString('en-US', { month: 'long' }),
        year: date.getFullYear(),
        date: date,
        dateString: dateString,
        value: parseFloat(snapshot.total_value) || 0,
        benchmark: benchmarkValue,
      };
    });

    // Always add the current calculated value as the latest point
    // This ensures the chart shows the latest portfolio value with current prices
    if (currentTotalValue) {
      const now = new Date();
      const todayString = now.toISOString().split('T')[0];
      const benchmarkValue = normalizedBenchmark[todayString] || null;

      const currentPoint = {
        month: now.toLocaleString('en-US', { month: 'short' }),
        monthFull: now.toLocaleString('en-US', { month: 'long' }),
        year: now.getFullYear(),
        date: now,
        dateString: todayString,
        value: currentTotalValue,
        benchmark: benchmarkValue,
      };

      // If we have snapshots, check if the last one is today
      // If not, or if the current value differs, add it as a new point
      if (data.length === 0) {
        data.push(currentPoint);
      } else {
        const lastPoint = data[data.length - 1];
        const lastDate = parseLocalDate(lastPoint.dateString);
        const isToday = now.toDateString() === lastDate.toDateString();

        // Always update the last point if it's today, or add a new point if it's a different day
        if (isToday) {
          // Update the last point with current value
          data[data.length - 1] = currentPoint;
        } else {
          // Add a new point for today
          data.push(currentPoint);
        }
      }
    }
    return data;
  }, [snapshots, currentTotalValue, benchmarkData, portfolio.starting_capital]);

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

  // Calculate y-axis domain to include both portfolio and benchmark values
  const yAxisDomain = useMemo(() => {
    if (displayChartData.length === 0) return ['dataMin', 'dataMax'];

    const allValues = displayChartData.flatMap(point => {
      const values = [point.value];
      if (point.benchmark !== null && point.benchmark !== undefined) {
        values.push(point.benchmark);
      }
      return values;
    });

    if (allValues.length === 0) return ['dataMin', 'dataMax'];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1; // 10% padding

    return [min - padding, max + padding];
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

    // For "ALL" time range, compare to initial starting capital
    // For other ranges, compare to the first point in the filtered data
    const startValue = timeRange === 'ALL'
      ? portfolio.starting_capital
      : displayChartData[0].value;

    // Use the display value (hovered point if hovering, otherwise current/last point)
    const displayValue = displayData.value;

    if (startValue === 0) return 0;
    return ((displayValue - startValue) / Math.abs(startValue)) * 100;
  }, [displayChartData, displayData, timeRange, portfolio.starting_capital]);

  // Calculate current benchmark (QQQ) value and % change
  const currentBenchmarkValue = useMemo(() => {
    const dateString = displayData?.dateString;
    if (!dateString) return null;
    return benchmarkData[dateString] || null;
  }, [benchmarkData, displayData]);

  const benchmarkPercentChange = useMemo(() => {
    if (!currentBenchmarkValue || snapshots.length === 0 || Object.keys(benchmarkData).length === 0) return null;

    // Find the first benchmark price (raw, not normalized) for comparison
    const firstSnapshotDate = snapshots[0].snapshot_date;
    let firstBenchmarkPrice = benchmarkData[firstSnapshotDate];

    // If first snapshot doesn't have benchmark, find the earliest available
    if (!firstBenchmarkPrice) {
      const sortedDates = Object.keys(benchmarkData).sort();
      if (sortedDates.length > 0) {
        firstBenchmarkPrice = benchmarkData[sortedDates[0]];
      }
    }

    if (!firstBenchmarkPrice || firstBenchmarkPrice <= 0) return null;

    // Calculate % change from first benchmark price (raw QQQ price)
    return ((currentBenchmarkValue - firstBenchmarkPrice) / firstBenchmarkPrice) * 100;
  }, [currentBenchmarkValue, benchmarkData, snapshots]);

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

  // Calculate sector diversification
  const sectorData = useMemo(() => {
    if (!portfolioMetrics.holdingsWithValues || portfolioMetrics.holdingsWithValues.length === 0) {
      return [];
    }

    // Group holdings by sector
    const sectorMap = new Map();
    portfolioMetrics.holdingsWithValues.forEach(holding => {
      const sectorName = holding.sector || 'Other';
      if (sectorMap.has(sectorName)) {
        sectorMap.set(sectorName, sectorMap.get(sectorName) + holding.value);
      } else {
        sectorMap.set(sectorName, holding.value);
      }
    });

    // Calculate total invested value
    const totalValue = portfolioMetrics.totalHoldingsValue;

    // Convert to array and calculate percentages
    const sectors = Array.from(sectorMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Assign opacity values for each sector (100% for first, decreasing for others)
    const sectorsWithOpacity = sectors.map((sector, index) => {
      const totalSectors = sectors.length;
      // First sector gets 100%, last gets 40%, linearly interpolate between
      const opacity = totalSectors > 1
        ? 1 - (index / (totalSectors - 1)) * 0.6
        : 1;

      return {
        ...sector,
        opacity: Math.max(0.4, opacity)
      };
    });

    return sectorsWithOpacity;
  }, [portfolioMetrics.holdingsWithValues, portfolioMetrics.totalHoldingsValue]);

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
      <>
        {/* Main Layout: Main Section + Side Column */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Section - 2/3 width */}
          <div className="lg:w-2/3 flex flex-col gap-6">
            {/* Portfolio Value Chart Card Skeleton */}
            <Card variant="glass" padding="none" className="animate-pulse">
              <div className="mb-4 px-6 pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="h-3 bg-[var(--color-border)] rounded w-24 mb-2" />
                    <div className="h-8 bg-[var(--color-border)] rounded w-40 mb-2" />
                    <div className="h-4 bg-[var(--color-border)] rounded w-32" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-3 bg-[var(--color-border)] rounded w-24" />
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-6 w-8 bg-[var(--color-border)] rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 pb-2 px-6">
                <div className="h-[320px] bg-[var(--color-border)] rounded" />
              </div>
            </Card>

            {/* Trades Table Skeleton */}
            <Card variant="glass" padding="none" className="animate-pulse">
              <div className="px-6 pt-6 pb-4">
                <div className="h-3 bg-[var(--color-border)] rounded w-16" />
              </div>
              <div className="divide-y divide-[var(--color-border)]/20">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-6 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 bg-[var(--color-border)] rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-[var(--color-border)] rounded w-32 mb-2" />
                          <div className="h-3 bg-[var(--color-border)] rounded w-24" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-12 bg-[var(--color-border)] rounded" />
                        <div className="h-4 w-16 bg-[var(--color-border)] rounded hidden sm:block" />
                        <div className="h-4 w-20 bg-[var(--color-border)] rounded hidden md:block" />
                        <div className="h-4 w-24 bg-[var(--color-border)] rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Side Column - 1/3 width */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            {/* Portfolio Summary Card Skeleton */}
            <Card variant="glass" padding="md" className="animate-pulse">
              <div className="mb-5">
                <div className="h-3 bg-[var(--color-border)] rounded w-20 mb-4" />
              </div>
              {/* Allocation Bar */}
              <div className="mb-6">
                <div className="h-3 bg-[var(--color-border)] rounded-full mb-2" />
                <div className="flex justify-between">
                  <div className="h-3 bg-[var(--color-border)] rounded w-16" />
                  <div className="h-3 bg-[var(--color-border)] rounded w-12" />
                </div>
              </div>
              {/* Cash and Holdings Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="h-3 bg-[var(--color-border)] rounded w-12 mb-2" />
                  <div className="h-6 bg-[var(--color-border)] rounded w-24 mb-1" />
                  <div className="h-3 bg-[var(--color-border)] rounded w-16" />
                </div>
                <div className="text-right">
                  <div className="h-3 bg-[var(--color-border)] rounded w-20 mb-2 ml-auto" />
                  <div className="h-6 bg-[var(--color-border)] rounded w-28 mb-1 ml-auto" />
                  <div className="h-3 bg-[var(--color-border)] rounded w-16 ml-auto" />
                </div>
              </div>
              {/* Rebalance Section */}
              <div className="pt-6 border-t border-[var(--color-border)]/30">
                <div className="h-3 bg-[var(--color-border)] rounded w-32 mb-3" />
                <div className="flex items-center justify-between">
                  <div className="h-8 bg-[var(--color-border)] rounded w-24" />
                  <div className="flex flex-col items-end gap-1">
                    <div className="h-4 bg-[var(--color-border)] rounded w-20" />
                    <div className="h-3 bg-[var(--color-border)] rounded w-24" />
                  </div>
                </div>
              </div>
            </Card>

            {/* Holdings Table Skeleton */}
            <Card variant="glass" padding="none" className="animate-pulse">
              <div className="px-6 pt-6 pb-4">
                <div className="h-3 bg-[var(--color-border)] rounded w-20" />
              </div>
              <div className="divide-y divide-[var(--color-border)]/20">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-[var(--color-border)] rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-[var(--color-border)] rounded w-20 mb-1" />
                          <div className="h-3 bg-[var(--color-border)] rounded w-16" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-[var(--color-border)] rounded w-24 mb-1" />
                        <div className="h-3 bg-[var(--color-border)] rounded w-16 ml-auto" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Main Layout: Main Section + Side Column */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Section - 2/3 width */}
        <div className="lg:w-2/3 flex flex-col gap-6">
          {/* Portfolio Value Chart Card */}
          <Card variant="glass" padding="none" onMouseLeave={handleCardMouseLeave}>
            <div className="mb-4 px-6 pt-6">
              <div className="flex justify-between items-start">
                <div className="flex gap-8">
                  {/* Portfolio Value */}
                  <div className="min-w-[180px]">
                    <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">Portfolio Value</div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight drop-shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.1)] tabular-nums">
                        <AnimatedCounter value={displayData?.value || 0} duration={120} />
                      </div>
                      <div className={`text-xs font-medium mt-0.5 ${dynamicPercentChange > 0 ? 'text-emerald-500' :
                        dynamicPercentChange < 0 ? 'text-rose-500' :
                          'text-[var(--color-muted)]'
                        }`}>
                        {(() => {
                          // Calculate the absolute change based on the time range
                          // Use the same start value as in dynamicPercentChange
                          const startValue = timeRange === 'ALL'
                            ? portfolio.starting_capital
                            : (displayChartData[0]?.value || 0);
                          // Use displayData.value (hovered point if hovering, otherwise current)
                          const displayValue = displayData.value;
                          const change = displayValue - startValue;
                          return (
                            <>
                              {change > 0 ? '+' : ''}
                              {formatCurrency(change)}
                              {' '}
                              ({dynamicPercentChange > 0 ? '+' : ''}{dynamicPercentChange.toFixed(2)}%)
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Benchmark Value (QQQ) */}
                  {currentBenchmarkValue !== null && (
                    <div className="min-w-[140px]">
                      <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">Benchmark (QQQ)</div>
                      <div className="flex flex-col">
                        <div className="text-xl font-medium text-[var(--color-muted)] tracking-tight tabular-nums">
                          {formatCurrencyWithSmallCents(currentBenchmarkValue)}
                        </div>
                        <div className={`text-xs font-medium mt-0.5 ${benchmarkPercentChange !== null && benchmarkPercentChange > 0 ? 'text-emerald-500' :
                          benchmarkPercentChange !== null && benchmarkPercentChange < 0 ? 'text-rose-500' :
                            'text-[var(--color-muted)]'
                          }`}>
                          {benchmarkPercentChange !== null ? (
                            <>
                              ({benchmarkPercentChange > 0 ? '+' : ''}{benchmarkPercentChange.toFixed(2)}%)
                            </>
                          ) : (
                            <span className="text-[var(--color-muted)]">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-[var(--color-muted)] font-medium">
                    {displayData?.dateString ?
                      parseLocalDate(displayData.dateString).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) :
                      `${displayData?.monthFull || 'Current'} ${displayData?.year || new Date().getFullYear()}`
                    }
                  </div>
                  {/* Time Range Selector */}
                  <div className="flex gap-1">
                    {availableRanges.map((range) => {
                      const isActive = timeRange === range;
                      const isDefaultAccent = !profile?.accent_color || profile.accent_color === validAccentColor;
                      const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
                      const activeTextColor = (isDarkMode && isDefaultAccent) ? 'var(--color-on-accent)' : '#fff';

                      return (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className="relative px-2.5 py-1 text-[10px] font-bold rounded-full transition-colors text-center cursor-pointer outline-none focus:outline-none"
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
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 pb-2">
              <div
                className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
                tabIndex={-1}
                style={{ outline: 'none', height: '240px' }}
                onMouseLeave={handleMouseLeave}
              >
                <LineChart
                  data={displayChartData}
                  dataKey="value"
                  width="100%"
                  height={240}
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
                  yAxisDomain={yAxisDomain}
                  lines={[
                    {
                      dataKey: 'value',
                      strokeColor: chartColor,
                      strokeWidth: 2,
                      showArea: true,
                      areaOpacity: 0.15,
                    },
                    {
                      dataKey: 'benchmark',
                      strokeColor: 'var(--color-muted)',
                      strokeWidth: 1.5,
                      strokeOpacity: 0.6,
                      showArea: false,
                    },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* Orders Table */}
          <Card variant="glass" padding="none">
            <div className="px-5 pt-5 pb-3">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Orders</div>
            </div>
            {trades.length > 0 ? (
              <div className="pb-3">
                {trades.map((trade) => {
                  const isBuy = trade.action.toLowerCase() === 'buy';

                  return (
                    <div
                      key={trade.id}
                      className="px-5 py-3 hover:bg-[var(--color-surface)]/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: Logo + Ticker + Details */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                            style={{
                              background: trade.logo ? 'transparent' : 'var(--color-surface)',
                              border: '1px solid var(--color-border)'
                            }}
                          >
                            {trade.logo ? (
                              <img src={trade.logo} alt={trade.ticker} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-medium text-[var(--color-muted)]">{trade.ticker.slice(0, 2)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--color-fg)] truncate">
                                {trade.ticker}
                              </span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isBuy
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                {isBuy ? 'BUY' : 'SELL'}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--color-muted)]">
                              {parseFloat(trade.shares).toFixed(2)} shares @ {formatCurrency(parseFloat(trade.price))}
                            </div>
                          </div>
                        </div>

                        {/* Right: Total + Date */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                            {formatCurrency(parseFloat(trade.total_value))}
                          </div>
                          <div className="text-[11px] text-[var(--color-muted)]/60">
                            {new Date(trade.executed_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Reasoning - shown below order details */}
                      {trade.reasoning && (
                        <div className="mt-2">
                          <p className="text-xs text-[var(--color-muted)] leading-relaxed line-clamp-2">
                            {trade.reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <div className="text-[var(--color-muted)]/60 text-sm">
                  No orders yet
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Side Column - 1/3 width */}
        <div className="lg:w-1/3 flex flex-col gap-4">
          {/* Portfolio Summary Card */}
          <Card variant="glass" padding="md">
            <div className="mb-4">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Summary</div>
            </div>
            {/* Allocation Bar - Styled like accounts summary bars */}
            <div className="mb-5">
              <div className="w-full h-3 flex rounded-full overflow-hidden bg-[var(--color-surface)]">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${100 - portfolioMetrics.cashPercentage}%`,
                    backgroundColor: 'var(--color-accent)'
                  }}
                />
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${portfolioMetrics.cashPercentage}%`,
                    backgroundColor: 'var(--color-muted)',
                    opacity: 0.4
                  }}
                />
              </div>
            </div>

            {/* Cash and Holdings - Minimal two-column layout */}
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Cash</div>
                <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                  {formatCurrencyWithSmallCents(portfolioMetrics.cash)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)] tabular-nums mt-0.5">
                  {portfolioMetrics.cashPercentage.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mb-0.5">Invested</div>
                <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                  {formatCurrencyWithSmallCents(portfolioMetrics.totalHoldingsValue)}
                </div>
                <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                  {holdings.length} position{holdings.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Rebalance Countdown - inline with summary */}
            {portfolio.next_rebalance_date && (
              <>
                <div className="my-4 border-t border-[var(--color-border)]/30" />
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mb-2">Next Rebalance</div>
                <RebalanceCountdown
                  nextRebalanceDate={portfolio.next_rebalance_date}
                  rebalanceCadence={portfolio.rebalance_cadence}
                />
              </>
            )}
          </Card>

          {/* Holdings Table */}
          <Card variant="glass" padding="none">
            {/* Header with See All */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Holdings</div>
              {portfolioMetrics.holdingsWithValues.length > 5 && (
                <button
                  onClick={() => setShowHoldingsDrawer(true)}
                  className="text-[11px] text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 font-medium transition-colors cursor-pointer"
                >
                  See All
                </button>
              )}
            </div>
            {portfolioMetrics.holdingsWithValues.length > 0 ? (
              <div className="pb-2">
                {portfolioMetrics.holdingsWithValues.slice(0, 5).map((holding, index) => {
                  const quote = stockQuotes[holding.ticker];
                  const currentPrice = quote?.price || null;
                  const avgCost = holding.avgCost;

                  let gainPercent = null;
                  let currentValue = holding.value;

                  if (currentPrice && avgCost > 0) {
                    gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
                    currentValue = holding.shares * currentPrice;
                  }

                  const hasQuote = gainPercent !== null;

                  return (
                    <div
                      key={holding.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--color-surface)]/20 transition-colors"
                    >
                      {/* Left: Logo + Ticker/Shares */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                          style={{
                            background: holding.logo ? 'transparent' : 'var(--color-surface)',
                            border: '1px solid var(--color-border)/50'
                          }}
                        >
                          {holding.logo ? (
                            <img src={holding.logo} alt={holding.ticker} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-medium text-[var(--color-muted)]">{holding.ticker.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                            {holding.ticker}
                          </div>
                          <div className="text-xs text-[var(--color-muted)]">
                            {holding.shares.toFixed(2)} shares
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                          {formatCurrency(currentValue)}
                        </div>
                        {hasQuote ? (
                          <div className={`text-xs tabular-nums ${Math.abs(gainPercent) < 0.005 ? 'text-[var(--color-muted)]' :
                            gainPercent > 0 ? 'text-emerald-500' :
                              'text-rose-500'
                            }`}>
                            {gainPercent > 0.005 ? '+' : ''}{gainPercent.toFixed(2)}%
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--color-muted)]">—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <div className="text-[var(--color-muted)]/60 text-[13px]">
                  No holdings yet
                </div>
              </div>
            )}
          </Card>

          {/* Sector Diversification Card - below Holdings */}
          {sectorData.length > 0 && (
            <Card variant="glass" padding="md">
              <div className="mb-3">
                <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Sectors</div>
              </div>

              {/* Minimal chip layout - polished */}
              <div className="flex flex-wrap gap-1.5">
                {sectorData.map((sector, index) => (
                  <div
                    key={sector.name}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-surface)]/60 border border-[var(--color-border)]/30"
                  >
                    <span className="text-[10px] text-[var(--color-muted)]">{sector.name}</span>
                    <span className="text-[10px] font-medium text-[var(--color-fg)] tabular-nums">
                      {sector.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

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

      {/* All Holdings Drawer */}
      <Drawer
        isOpen={showHoldingsDrawer}
        onClose={() => setShowHoldingsDrawer(false)}
        title="All Holdings"
        description={`${portfolioMetrics.holdingsWithValues.length} positions`}
        size="md"
      >
        <div className="divide-y divide-[var(--color-border)]/10">
          {portfolioMetrics.holdingsWithValues.map((holding) => {
            const quote = stockQuotes[holding.ticker];
            const currentPrice = quote?.price || null;
            const avgCost = holding.avgCost;

            let gainPercent = null;
            let currentValue = holding.value;

            if (currentPrice && avgCost > 0) {
              gainPercent = ((currentPrice - avgCost) / avgCost) * 100;
              currentValue = holding.shares * currentPrice;
            }

            const hasQuote = gainPercent !== null;

            return (
              <div
                key={holding.id}
                className="flex items-center justify-between py-2.5"
              >
                {/* Left: Logo + Ticker/Shares */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{
                      background: holding.logo ? 'transparent' : 'var(--color-surface)',
                      border: '1px solid var(--color-border)/50'
                    }}
                  >
                    {holding.logo ? (
                      <img src={holding.logo} alt={holding.ticker} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-medium text-[var(--color-muted)]">{holding.ticker.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[var(--color-fg)] truncate">
                      {holding.ticker}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)]/70">
                      {holding.shares.toFixed(2)} shares
                    </div>
                  </div>
                </div>

                {/* Right: Value + Performance */}
                <div className="text-right">
                  <div className="text-[13px] font-medium text-[var(--color-fg)] tabular-nums">
                    {formatCurrency(currentValue)}
                  </div>
                  {hasQuote ? (
                    <div className={`text-[11px] tabular-nums ${Math.abs(gainPercent) < 0.005 ? 'text-[var(--color-muted)]/60' :
                      gainPercent > 0 ? 'text-emerald-500/80' :
                        'text-rose-500/80'
                      }`}>
                      {gainPercent > 0.005 ? '+' : ''}{gainPercent.toFixed(2)}%
                    </div>
                  ) : (
                    <div className="text-[11px] text-[var(--color-muted)]/40">—</div>
                  )}
                </div>
              </div>
            );
          })}
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
            {returnAmount >= 0 ? '+' : ''}{formatCurrencyWithSmallCents(returnAmount)}
            {' '}
            ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(2)}%)
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mt-2">
          <span>{formatCurrencyWithSmallCents(portfolio.starting_capital)} initial</span>
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
      {/* Animated AI icon */}
      <div className="mb-6 flex items-center justify-center">
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
      <PageContainer>
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

  // Animation variants for slide transitions - faster and smoother
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  };

  // Direction: 1 = forward (to detail), -1 = back (to list)
  const direction = selectedPortfolio ? 1 : -1;

  return (
    <PageContainer>
      {/* Breadcrumb Navigation - Always at top, updates based on view */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          {selectedPortfolio ? (
            <>
              <button
                onClick={() => setSelectedPortfolio(null)}
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
              >
                Portfolios
              </button>
              <LuChevronRight className="w-3.5 h-3.5 text-[var(--color-border)]" />
              <span className="text-[var(--color-fg)] font-medium">{selectedPortfolio.name}</span>
            </>
          ) : (
            <span className="text-[var(--color-fg)] font-medium">Portfolios</span>
          )}
        </div>
        {selectedPortfolio ? (
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-all cursor-pointer"
            title="Portfolio Settings"
          >
            <LuSettings className="w-4 h-4" />
          </button>
        ) : (
          hasPortfolios && (
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <LuPlus className="w-4 h-4" />
              New Portfolio
            </Button>
          )
        )}
      </div>

      {/* Animated Content Area */}
      <AnimatePresence mode="wait" custom={direction}>
        {selectedPortfolio ? (
          <motion.div
            key="detail"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
          >
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
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
          >
            {/* Header with Description */}
            {hasPortfolios && (
              <div>
                <h2 className="text-lg font-medium text-[var(--color-fg)] mb-1">AI Trading Portfolios</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Watch AI models compete in paper trading simulations
                </p>
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

