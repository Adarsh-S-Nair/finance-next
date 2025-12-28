"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import Card from "../../../../components/ui/Card";
import Button from "../../../../components/ui/Button";
import Drawer from "../../../../components/ui/Drawer";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import LineChart from "../../../../components/ui/LineChart";
import { LuTrash2 } from "react-icons/lu";
import { useUser } from "../../../../components/UserProvider";
import { supabase } from "../../../../lib/supabaseClient";
import { useInvestmentsHeader } from "../InvestmentsHeaderContext";
import { ChartSkeleton, CardSkeleton, HoldingsTableSkeleton } from "../../../../components/ui/Skeleton";

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

// Parse a date string (YYYY-MM-DD) as a local date, not UTC
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
      const minutes = Math.floor((diff % (1000 * 60)) / 60);
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

export default function PortfolioDetailPage() {
  const router = useRouter();
  const params = useParams();
  const portfolioId = params.portfolio_id;
  const { profile } = useUser();
  const { setHeaderActions } = useInvestmentsHeader();
  const [portfolio, setPortfolio] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  const [timeRange, setTimeRange] = useState('ALL');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);
  const [stockQuotes, setStockQuotes] = useState({});
  const [benchmarkData, setBenchmarkData] = useState({});
  const [showHoldingsDrawer, setShowHoldingsDrawer] = useState(false);
  const [computedAccentColor, setComputedAccentColor] = useState('#00f3ff');
  const [holdings, setHoldings] = useState([]);
  const [trades, setTrades] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [marketStatus, setMarketStatus] = useState(null);
  const [cryptoCandles, setCryptoCandles] = useState({}); // { 'BTC-USD': [...candles], 'ETH-USD': [...candles] }

  // Register header actions with layout
  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions({
        onSettingsClick: () => setShowSettings(true),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderActions]);

  // Calculate current total value
  const currentTotalValue = useMemo(() => {
    if (!portfolio) return 0;
    const cash = parseFloat(portfolio.current_cash) || 0;

    let holdingsValue = 0;
    
    // For crypto portfolios, calculate value from latest candle prices
    if (portfolio.asset_type === 'crypto' && portfolio.crypto_assets) {
      const cryptoAssets = portfolio.crypto_assets;
      cryptoAssets.forEach(symbol => {
        const productId = `${symbol.toUpperCase()}-USD`;
        const candles = cryptoCandles[productId] || [];
        if (candles.length > 0) {
          // Use the most recent candle's close price
          const latestCandle = candles[candles.length - 1];
          const price = latestCandle.close || 0;
          
          // Find holding for this crypto
          const holding = holdings.find(h => h.ticker.toUpperCase() === symbol.toUpperCase());
          if (holding) {
            const shares = parseFloat(holding.shares) || 0;
            holdingsValue += shares * price;
          }
        }
      });
    } else {
      // For stock portfolios, use stock quotes
      if (holdings.length > 0) {
        holdingsValue = holdings.reduce((sum, holding) => {
          const shares = parseFloat(holding.shares) || 0;
          const ticker = holding.ticker.toUpperCase();
          const quote = stockQuotes[ticker];
          const currentPrice = quote?.price || parseFloat(holding.avg_cost) || 0;
          return sum + shares * currentPrice;
        }, 0);
      }
    }

    return cash + holdingsValue;
  }, [holdings, portfolio?.current_cash, stockQuotes, portfolio?.id, portfolio?.asset_type, portfolio?.crypto_assets, cryptoCandles]);

  // Fetch portfolio and data
  useEffect(() => {
    const fetchData = async () => {
      if (!portfolioId) return;

      try {
        // Fetch portfolio
        const { data: portfolioData, error: portfolioError } = await supabase
          .from('portfolios')
          .select('*')
          .eq('id', portfolioId)
          .single();

        if (portfolioError) throw portfolioError;
        if (!portfolioData) {
          router.push('/investments');
          return;
        }

        setPortfolio(portfolioData);

        // Fetch market status for Alpaca portfolios
        if (portfolioData.is_alpaca_connected) {
          try {
            const marketStatusRes = await fetch(`/api/portfolios/${portfolioId}/market-status`);
            if (marketStatusRes.ok) {
              const marketStatusData = await marketStatusRes.json();
              setMarketStatus(marketStatusData);
            }
          } catch (marketStatusErr) {
            console.error('Error fetching market status:', marketStatusErr);
          }
        }

        // Fetch snapshots (for non-crypto portfolios or as fallback)
        const { data: snapshotsData, error: snapshotsError } = await supabase
          .from('portfolio_snapshots')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .order('snapshot_date', { ascending: true });

        if (snapshotsError) throw snapshotsError;
        setSnapshots(snapshotsData || []);

        // Fetch crypto candles for crypto portfolios
        if (portfolioData.asset_type === 'crypto' && portfolioData.crypto_assets && Array.isArray(portfolioData.crypto_assets) && portfolioData.crypto_assets.length > 0) {
          try {
            // Convert crypto symbols (BTC, ETH) to Coinbase product IDs (BTC-USD, ETH-USD)
            const products = portfolioData.crypto_assets
              .map(symbol => `${symbol.toUpperCase()}-USD`)
              .join(',');

            // Calculate time range - fetch last 30 days by default
            // Timeframe will be selected based on timeRange later, but start with 1h for good balance
            const endTime = new Date();
            const startTime = new Date();
            startTime.setDate(startTime.getDate() - 30);

            const timeframe = '1h'; // Default to 1h candles

            const candlesRes = await fetch(
              `/api/market-data/crypto-candles?products=${products}&timeframe=${timeframe}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`
            );

            if (candlesRes.ok) {
              const candlesData = await candlesRes.json();
              setCryptoCandles(candlesData.candles || {});
            } else {
              console.error('Failed to fetch crypto candles:', await candlesRes.text());
            }
          } catch (candlesErr) {
            console.error('Error fetching crypto candles:', candlesErr);
          }
        }

        // Fetch benchmark data
        // Use SPY for Alpaca portfolios, QQQ for AI portfolios
        const benchmarkTicker = portfolioData.is_alpaca_connected ? 'SPY' : 'QQQ';
        
        if (snapshotsData && snapshotsData.length > 0) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const snapshotDates = snapshotsData.map(s => s.snapshot_date);
            const benchmarkPrices = {};

            if (snapshotDates.length > 0) {
              const historicalRes = await fetch(`/api/market-data/historical?ticker=${benchmarkTicker}&dates=${snapshotDates.join(',')}`);
              if (historicalRes.ok) {
                const historicalResult = await historicalRes.json();
                Object.assign(benchmarkPrices, historicalResult.prices || {});
              }
            }

            const quotesRes = await fetch(`/api/market-data/quotes?tickers=${benchmarkTicker}`);
            if (quotesRes.ok) {
              const quotesResult = await quotesRes.json();
              const benchmarkQuote = quotesResult.quotes?.[benchmarkTicker];
              if (benchmarkQuote?.price && !benchmarkPrices[today]) {
                benchmarkPrices[today] = benchmarkQuote.price;
              }
            }

            setBenchmarkData(benchmarkPrices);
          } catch (benchmarkErr) {
            console.error('Error fetching benchmark data:', benchmarkErr);
          }
        }

        // Fetch holdings
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('holdings')
          .select('*')
          .eq('portfolio_id', portfolioId);

        if (holdingsError) throw holdingsError;

        if (holdingsData && holdingsData.length > 0) {
          const tickers = holdingsData.map(h => h.ticker.toUpperCase());
          const { data: tickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector')
            .in('symbol', tickers);

          const tickerMap = new Map();
          if (tickersData) {
            tickersData.forEach(t => {
              tickerMap.set(t.symbol, { logo: t.logo, name: t.name, sector: t.sector });
            });
          }

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
          .from('trades')
          .select('*')
          .eq('portfolio_id', portfolioId)
          .order('executed_at', { ascending: false });

        if (tradesError) throw tradesError;

        if (tradesData && tradesData.length > 0) {
          const tradeTickers = [...new Set(tradesData.map(t => t.ticker.toUpperCase()))];
          const { data: tradeTickersData } = await supabase
            .from('tickers')
            .select('symbol, logo, name, sector')
            .in('symbol', tradeTickers);

          const tradeTickerMap = new Map();
          if (tradeTickersData) {
            tradeTickersData.forEach(t => {
              tradeTickerMap.set(t.symbol, { logo: t.logo, name: t.name, sector: t.sector });
            });
          }

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
        router.push('/investments');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portfolioId, router]);

  // Periodically refresh stock quotes
  useEffect(() => {
    if (holdings.length === 0 || !portfolio) return;

    const tickers = holdings.map(h => h.ticker.toUpperCase());
    const tickerList = tickers.join(',');
    const cacheKey = `portfolio_quotes_${portfolio.id}`;
    const CACHE_TTL_MS = 5 * 60 * 1000;

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

    const cachedQuotes = loadCachedQuotes();
    if (cachedQuotes) {
      setStockQuotes(cachedQuotes);
    } else {
      fetchQuotes();
    }

    const interval = setInterval(fetchQuotes, CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [holdings, portfolio]);

  // Get computed accent color
  useEffect(() => {
    if (profile?.accent_color && profile.accent_color.startsWith('#')) {
      setComputedAccentColor(profile.accent_color);
      return;
    }

    if (typeof window !== 'undefined') {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      let hexColor = null;

      if (color && color.startsWith('#')) {
        hexColor = color;
      } else if (color) {
        const tempDiv = document.createElement('div');
        tempDiv.style.color = color;
        document.body.appendChild(tempDiv);
        const computedColor = getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);

        const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
          const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
          const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
          hexColor = `#${r}${g}${b}`;
        }
      }

      if (hexColor) {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        const brightness = (r + g + b) / 3;

        if (brightness > 200) {
          setComputedAccentColor('#00f3ff');
        } else {
          setComputedAccentColor(hexColor);
        }
      } else {
        setComputedAccentColor('#00f3ff');
      }
    }
  }, [profile?.accent_color]);

  // Chart data calculations
  const chartData = useMemo(() => {
    if (!portfolio) return [];
    const startingCapital = parseFloat(portfolio.starting_capital) || 100000;
    
    // For crypto portfolios, build chart from crypto candles
    if (portfolio.asset_type === 'crypto' && portfolio.crypto_assets && Object.keys(cryptoCandles).length > 0) {
      const cash = parseFloat(portfolio.current_cash) || 0;
      const data = [];
      
      // Get all unique timestamps from all crypto candles
      const allTimestamps = new Set();
      Object.values(cryptoCandles).forEach(candles => {
        candles.forEach(candle => {
          allTimestamps.add(candle.time);
        });
      });
      
      const sortedTimestamps = Array.from(allTimestamps).sort();
      
      // Build chart data points from candles
      sortedTimestamps.forEach(timestamp => {
        const candleTime = new Date(timestamp);
        let holdingsValue = 0;
        
        // Calculate portfolio value at this timestamp
        portfolio.crypto_assets.forEach(symbol => {
          const productId = `${symbol.toUpperCase()}-USD`;
          const candles = cryptoCandles[productId] || [];
          
          // Find candle at or before this timestamp
          const candle = candles.find(c => new Date(c.time).getTime() <= candleTime.getTime());
          if (!candle) {
            // Try to find the closest candle
            const sortedCandles = [...candles].sort((a, b) => 
              new Date(a.time).getTime() - new Date(b.time).getTime()
            );
            const closestCandle = sortedCandles.find(c => new Date(c.time).getTime() >= candleTime.getTime()) 
              || sortedCandles[sortedCandles.length - 1];
            if (closestCandle) {
              const holding = holdings.find(h => h.ticker.toUpperCase() === symbol.toUpperCase());
              if (holding) {
                const shares = parseFloat(holding.shares) || 0;
                holdingsValue += shares * (closestCandle.close || 0);
              }
            }
          } else {
            const holding = holdings.find(h => h.ticker.toUpperCase() === symbol.toUpperCase());
            if (holding) {
              const shares = parseFloat(holding.shares) || 0;
              holdingsValue += shares * (candle.close || 0);
            }
          }
        });
        
        const totalValue = cash + holdingsValue;
        const dateString = candleTime.toISOString().split('T')[0];
        
        data.push({
          month: candleTime.toLocaleString('en-US', { month: 'short' }),
          monthFull: candleTime.toLocaleString('en-US', { month: 'long' }),
          year: candleTime.getFullYear(),
          date: candleTime,
          dateString: dateString,
          value: totalValue,
          benchmark: null, // No benchmark for crypto yet
        });
      });
      
      // Add current point if we have current value
      if (currentTotalValue && data.length > 0) {
        const now = new Date();
        const lastPoint = data[data.length - 1];
        const lastDate = new Date(lastPoint.date);
        const isToday = now.toDateString() === lastDate.toDateString();
        
        if (!isToday) {
          const todayString = now.toISOString().split('T')[0];
          data.push({
            month: now.toLocaleString('en-US', { month: 'short' }),
            monthFull: now.toLocaleString('en-US', { month: 'long' }),
            year: now.getFullYear(),
            date: now,
            dateString: todayString,
            value: currentTotalValue,
            benchmark: null,
          });
        } else {
          data[data.length - 1] = {
            ...lastPoint,
            value: currentTotalValue,
          };
        }
      }
      
      return data;
    }
    
    // For non-crypto portfolios, use snapshots (original logic)
    let firstBenchmarkPrice = null;
    let normalizedBenchmark = {};

    if (snapshots.length > 0 && Object.keys(benchmarkData).length > 0) {
      const firstSnapshotDate = snapshots[0].snapshot_date;
      firstBenchmarkPrice = benchmarkData[firstSnapshotDate];

      if (!firstBenchmarkPrice) {
        const sortedDates = Object.keys(benchmarkData).sort();
        if (sortedDates.length > 0) {
          firstBenchmarkPrice = benchmarkData[sortedDates[0]];
        }
      }

      if (firstBenchmarkPrice && firstBenchmarkPrice > 0) {
        Object.keys(benchmarkData).forEach(dateStr => {
          const price = benchmarkData[dateStr];
          if (price && price > 0) {
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

      if (data.length === 0) {
        data.push(currentPoint);
      } else {
        const lastPoint = data[data.length - 1];
        const lastDate = parseLocalDate(lastPoint.dateString);
        const isToday = now.toDateString() === lastDate.toDateString();

        if (isToday) {
          data[data.length - 1] = currentPoint;
        } else {
          data.push(currentPoint);
        }
      }
    }
    return data;
  }, [snapshots, currentTotalValue, benchmarkData, portfolio?.starting_capital, portfolio?.asset_type, portfolio?.crypto_assets, portfolio?.current_cash, cryptoCandles, holdings]);

  const filteredData = useMemo(() => {
    if (chartData.length === 0) return [];
    if (timeRange === 'ALL') return chartData;
    
    // For 1D view, we'll create synthetic intraday data points, so return empty
    // and handle it in displayChartData
    if (timeRange === '1D') return [];

    const now = new Date();
    let startDate = new Date(now);

    switch (timeRange) {
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

    // Don't go back further than the portfolio creation date
    if (portfolio?.created_at) {
      const portfolioCreatedAt = new Date(portfolio.created_at);
      // Set to start of day for comparison
      portfolioCreatedAt.setHours(0, 0, 0, 0);
      if (startDate < portfolioCreatedAt) {
        startDate = portfolioCreatedAt;
      }
    }

    const filtered = chartData.filter(item => item.date >= startDate);
    // If there isn't enough data for the selected range, show all available data
    // but keep the selected range highlighted
    if (filtered.length === 0 && chartData.length > 0) {
      return chartData;
    }
    return filtered;
  }, [chartData, timeRange, portfolio?.created_at]);

  const displayChartData = useMemo(() => {
    // Handle 1D view with synthetic intraday data points
    if (timeRange === '1D') {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Don't go back further than portfolio creation
      let startTime = twentyFourHoursAgo;
      if (portfolio?.created_at) {
        const portfolioCreatedAt = new Date(portfolio.created_at);
        if (startTime < portfolioCreatedAt) {
          startTime = portfolioCreatedAt;
        }
      }
      
      // Get the most recent snapshot value (or starting capital if no snapshots)
      const mostRecentSnapshot = chartData.length > 0 ? chartData[chartData.length - 1] : null;
      const baseValue = mostRecentSnapshot?.value || portfolio?.starting_capital || currentTotalValue || 0;
      const currentValue = currentTotalValue || baseValue;
      
      // Create up to 40 evenly spaced data points
      const maxPoints = 40;
      const timeSpan = now.getTime() - startTime.getTime();
      const interval = Math.max(timeSpan / maxPoints, 60 * 1000); // At least 1 minute intervals
      const points = [];
      
      for (let time = startTime.getTime(); time <= now.getTime(); time += interval) {
        const pointTime = new Date(time);
        const progress = (time - startTime.getTime()) / timeSpan;
        
        // Interpolate value between base and current (simple linear interpolation)
        const value = baseValue + (currentValue - baseValue) * progress;
        
        // Create a unique dateString that includes time for proper x-axis matching
        const dateTimeString = pointTime.toISOString();
        
        points.push({
          month: pointTime.toLocaleString('en-US', { month: 'short' }),
          monthFull: pointTime.toLocaleString('en-US', { month: 'long' }),
          year: pointTime.getFullYear(),
          date: pointTime,
          dateString: dateTimeString, // Use full ISO string for 1D to ensure unique matching
          dateOnlyString: pointTime.toISOString().split('T')[0],
          timeString: pointTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          value: value,
          benchmark: null, // No benchmark for intraday
        });
        
        if (points.length >= maxPoints) break;
      }
      
      // Always include current point
      if (points.length === 0 || points[points.length - 1].date.getTime() < now.getTime() - 1000) {
        const nowDateTimeString = now.toISOString();
        points.push({
          month: now.toLocaleString('en-US', { month: 'short' }),
          monthFull: now.toLocaleString('en-US', { month: 'long' }),
          year: now.getFullYear(),
          date: now,
          dateString: nowDateTimeString, // Use full ISO string for 1D
          dateOnlyString: now.toISOString().split('T')[0],
          timeString: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          value: currentValue,
          benchmark: null,
        });
      }
      
      return points;
    }
    
    if (filteredData.length <= 1) {
      const singlePoint = filteredData.length === 1 ? filteredData[0] : (chartData.length > 0 ? chartData[chartData.length - 1] : null);
      if (!singlePoint) return [];

      const originalDate = new Date(singlePoint.date);
      const earlierDate = new Date(originalDate);
      let daysOffset = 30;
      if (timeRange === '1W') daysOffset = 7;

      earlierDate.setDate(earlierDate.getDate() - daysOffset);

      // Don't go back further than the portfolio creation date
      if (portfolio?.created_at) {
        const portfolioCreatedAt = new Date(portfolio.created_at);
        portfolioCreatedAt.setHours(0, 0, 0, 0);
        if (earlierDate < portfolioCreatedAt) {
          earlierDate.setTime(portfolioCreatedAt.getTime());
        }
      }

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
  }, [filteredData, chartData, timeRange, portfolio?.created_at, portfolio?.starting_capital, currentTotalValue]);

  const chartColor = useMemo(() => {
    if (displayChartData.length < 2) return 'var(--color-success)';
    const startValue = displayChartData[0].value;
    const endValue = displayChartData[displayChartData.length - 1].value;
    return endValue >= startValue ? 'var(--color-success)' : 'var(--color-danger)';
  }, [displayChartData]);

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
    const padding = (max - min) * 0.1;

    return [min - padding, max + padding];
  }, [displayChartData]);

  const availableRanges = useMemo(() => {
    // Include 1D for intraday view
    return ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];
  }, []);

  const currentData = activeIndex !== null ? displayChartData[activeIndex] : displayChartData[displayChartData.length - 1];
  const fallbackData = {
    value: currentTotalValue || portfolio?.starting_capital || 0,
    dateString: new Date().toISOString().split('T')[0],
    monthFull: new Date().toLocaleString('en-US', { month: 'long' }),
    year: new Date().getFullYear()
  };
  const displayData = currentData || fallbackData;

  const dynamicPercentChange = useMemo(() => {
    if (!portfolio || displayChartData.length < 1) return 0;

    const startValue = timeRange === 'ALL'
      ? portfolio.starting_capital
      : displayChartData[0].value;

    const displayValue = displayData.value;

    if (startValue === 0) return 0;
    return ((displayValue - startValue) / Math.abs(startValue)) * 100;
  }, [displayChartData, displayData, timeRange, portfolio?.starting_capital]);

  const currentBenchmarkValue = useMemo(() => {
    const dateString = displayData?.dateString;
    if (!dateString) return null;
    return benchmarkData[dateString] || null;
  }, [benchmarkData, displayData]);

  const benchmarkPercentChange = useMemo(() => {
    if (!currentBenchmarkValue || snapshots.length === 0 || Object.keys(benchmarkData).length === 0) return null;

    const firstSnapshotDate = snapshots[0].snapshot_date;
    let firstBenchmarkPrice = benchmarkData[firstSnapshotDate];

    if (!firstBenchmarkPrice) {
      const sortedDates = Object.keys(benchmarkData).sort();
      if (sortedDates.length > 0) {
        firstBenchmarkPrice = benchmarkData[sortedDates[0]];
      }
    }

    if (!firstBenchmarkPrice || firstBenchmarkPrice <= 0) return null;

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

  // Portfolio metrics
  const portfolioMetrics = useMemo(() => {
    if (!portfolio) return { cash: 0, totalHoldingsValue: 0, totalPortfolioValue: 0, holdingsWithValues: [], cashPercentage: 0 };
    const cash = parseFloat(portfolio.current_cash) || 0;

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
        percentage: 0
      };
    });

    const totalPortfolioValue = cash + totalHoldingsValue;

    holdingsWithValues.forEach(holding => {
      holding.percentage = totalPortfolioValue > 0 ? (holding.value / totalPortfolioValue) * 100 : 0;
    });

    holdingsWithValues.sort((a, b) => b.value - a.value);

    return {
      cash,
      totalHoldingsValue,
      totalPortfolioValue,
      holdingsWithValues,
      cashPercentage: totalPortfolioValue > 0 ? (cash / totalPortfolioValue) * 100 : 0
    };
  }, [holdings, portfolio?.current_cash]);

  const sectorData = useMemo(() => {
    if (!portfolioMetrics.holdingsWithValues || portfolioMetrics.holdingsWithValues.length === 0) {
      return [];
    }

    const sectorMap = new Map();
    portfolioMetrics.holdingsWithValues.forEach(holding => {
      const sectorName = holding.sector || 'Other';
      if (sectorMap.has(sectorName)) {
        sectorMap.set(sectorName, sectorMap.get(sectorName) + holding.value);
      } else {
        sectorMap.set(sectorName, holding.value);
      }
    });

    const totalValue = portfolioMetrics.totalHoldingsValue;

    const sectors = Array.from(sectorMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const sectorsWithOpacity = sectors.map((sector, index) => {
      const totalSectors = sectors.length;
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
    if (showSettings) setShowSettings(false);
    setDeleteModal({ isOpen: true });
  };

  const handleConfirmDelete = async () => {
    if (!portfolio) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', portfolio.id);

      if (error) throw error;

      setDeleteModal({ isOpen: false });
      router.push('/investments');
    } catch (err) {
      console.error('Error deleting portfolio:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || !portfolio) {
    return (
      <>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Section */}
          <div className="lg:w-2/3 flex flex-col gap-6">
            <ChartSkeleton />
            <CardSkeleton className="h-64" />
          </div>

          {/* Side Column */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            <CardSkeleton className="h-48" />
            <HoldingsTableSkeleton />
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
            <div className="mb-4 px-4 sm:px-6 pt-4 sm:pt-6">
              {/* Mobile Layout: Horizontal */}
              <div className="flex sm:hidden justify-between items-start">
                {/* Portfolio Value */}
                <div>
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
                        const startValue = timeRange === 'ALL'
                          ? portfolio.starting_capital
                          : (displayChartData[0]?.value || 0);
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

                {/* Date and Legend - Mobile */}
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-xs text-[var(--color-muted)] font-medium">
                    {timeRange === '1D' && displayData?.date ? (
                      <>
                        {displayData.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {' '}
                        {displayData.timeString}
                      </>
                    ) : displayData?.dateString ? (
                      parseLocalDate(displayData.dateString).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    ) : (
                      `${displayData?.monthFull || 'Current'} ${displayData?.year || new Date().getFullYear()}`
                    )}
                  </div>
                  {/* Legend - Mobile */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-[3px] rounded-full" style={{ backgroundColor: chartColor }} />
                      <span className={`text-[10px] font-medium tabular-nums ${dynamicPercentChange > 0 ? 'text-emerald-500' :
                          dynamicPercentChange < 0 ? 'text-rose-500' :
                            'text-[var(--color-muted)]'
                        }`}>
                        {dynamicPercentChange > 0 ? '+' : ''}{dynamicPercentChange.toFixed(2)}%
                      </span>
                    </div>
                    {currentBenchmarkValue !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-[3px] rounded-full bg-[var(--color-muted)] opacity-60" />
                        <span className="text-[10px] text-[var(--color-muted)]">{portfolio?.is_alpaca_connected ? 'SPY' : 'QQQ'}</span>
                        <span className={`text-[10px] font-medium tabular-nums ${benchmarkPercentChange !== null && benchmarkPercentChange > 0 ? 'text-emerald-500' :
                            benchmarkPercentChange !== null && benchmarkPercentChange < 0 ? 'text-rose-500' :
                              'text-[var(--color-muted)]'
                          }`}>
                          {benchmarkPercentChange !== null ? (
                            <>{benchmarkPercentChange > 0 ? '+' : ''}{benchmarkPercentChange.toFixed(2)}%</>
                          ) : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Layout: Horizontal */}
              <div className="hidden sm:flex justify-between items-start">
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
                          const startValue = timeRange === 'ALL'
                            ? portfolio.starting_capital
                            : (displayChartData[0]?.value || 0);
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
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="text-xs text-[var(--color-muted)] font-medium">
                    {timeRange === '1D' && displayData?.date ? (
                      <>
                        {displayData.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {' '}
                        {displayData.timeString}
                      </>
                    ) : displayData?.dateString ? (
                      parseLocalDate(displayData.dateString).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    ) : (
                      `${displayData?.monthFull || 'Current'} ${displayData?.year || new Date().getFullYear()}`
                    )}
                  </div>
                  {/* Legend - Desktop */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-[3px] rounded-full" style={{ backgroundColor: chartColor }} />
                      <span className="text-xs text-[var(--color-muted)]">Portfolio</span>
                      <span className={`text-xs font-medium tabular-nums ${dynamicPercentChange > 0 ? 'text-emerald-500' :
                          dynamicPercentChange < 0 ? 'text-rose-500' :
                            'text-[var(--color-muted)]'
                        }`}>
                        {dynamicPercentChange > 0 ? '+' : ''}{dynamicPercentChange.toFixed(2)}%
                      </span>
                    </div>
                    {currentBenchmarkValue !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-[3px] rounded-full bg-[var(--color-muted)] opacity-60" />
                        <span className="text-xs text-[var(--color-muted)]">{portfolio?.is_alpaca_connected ? 'SPY' : 'QQQ'}</span>
                        <span className={`text-xs font-medium tabular-nums ${benchmarkPercentChange !== null && benchmarkPercentChange > 0 ? 'text-emerald-500' :
                            benchmarkPercentChange !== null && benchmarkPercentChange < 0 ? 'text-rose-500' :
                              'text-[var(--color-muted)]'
                          }`}>
                          {benchmarkPercentChange !== null ? (
                            <>{benchmarkPercentChange > 0 ? '+' : ''}{benchmarkPercentChange.toFixed(2)}%</>
                          ) : '—'}
                        </span>
                      </div>
                    )}
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
                  xAxisDataKey={timeRange === '1D' ? 'dateString' : 'dateString'}
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

            {/* Time Range Selector - moved to bottom and spread evenly */}
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

                      {/* Reasoning */}
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
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Summary</div>
              {/* Market Status Indicator - Only for Alpaca portfolios */}
              {portfolio.is_alpaca_connected && marketStatus && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: marketStatus.is_open ? '#10b981' : '#ef4444',
                    }}
                  />
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {marketStatus.is_open ? 'Market Open' : 'Market Closed'}
                  </span>
                </div>
              )}
            </div>
            {/* Allocation Bar */}
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

            {/* Cash and Holdings */}
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

            {/* Rebalance Countdown */}
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
                {portfolioMetrics.holdingsWithValues.slice(0, 5).map((holding) => {
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

          {/* Sector Diversification Card */}
          {sectorData.length > 0 && (
            <Card variant="glass" padding="md">
              <div className="mb-3">
                <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">Sectors</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sectorData.map((sector) => (
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
        onClose={() => setShowSettings(false)}
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

