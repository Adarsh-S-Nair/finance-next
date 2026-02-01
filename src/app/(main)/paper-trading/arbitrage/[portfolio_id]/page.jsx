"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "../../../../../components/ui/Card";
import LineChart from "../../../../../components/ui/LineChart";
import {
  LuArrowRight,
  LuCircle,
  LuTrendingUp,
  LuRefreshCw,
} from "react-icons/lu";
import { useUser } from "../../../../../components/UserProvider";
import { supabase } from "../../../../../lib/supabaseClient";
import { usePaperTradingHeader } from "../../PaperTradingHeaderContext";
import { CardSkeleton, ChartSkeleton } from "../../../../../components/ui/Skeleton";

// Polling interval (5 seconds)
const POLL_INTERVAL = 5000;

// Animated price component with smooth transitions
const AnimatedPrice = ({ value, prefix = "$", decimals = 2, className = "" }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current && prevValueRef.current !== null && value !== null) {
      setDirection(value > prevValueRef.current ? 'up' : 'down');
      setDisplayValue(value);

      const timer = setTimeout(() => setDirection(null), 600);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
    setDisplayValue(value);
  }, [value]);

  const formatted = displayValue !== null && displayValue !== undefined
    ? `${prefix}${Number(displayValue).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`
    : '—';

  return (
    <span
      className={`
        ${className}
        inline-block transition-all duration-200
        ${direction === 'up' ? 'text-emerald-500' : ''}
        ${direction === 'down' ? 'text-rose-500' : ''}
      `}
    >
      {formatted}
    </span>
  );
};

// Exchange info with logos and colors
const EXCHANGE_INFO = {
  coinbase: {
    name: 'Coinbase',
    short: 'CB',
    logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png',
    color: '#0052FF',
    bgColor: 'rgba(0, 82, 255, 0.1)',
  },
  binance: {
    name: 'Binance',
    short: 'BIN',
    logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg',
    color: '#F0B90B',
    bgColor: 'rgba(240, 185, 11, 0.1)',
  },
  kraken: {
    name: 'Kraken',
    short: 'KRK',
    logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg',
    color: '#5741D9',
    bgColor: 'rgba(87, 65, 217, 0.1)',
  },
  kucoin: {
    name: 'KuCoin',
    short: 'KC',
    logo: 'https://assets.coingecko.com/markets/images/61/small/kucoin.png',
    color: '#23AF91',
    bgColor: 'rgba(35, 175, 145, 0.1)',
  },
  bybit: {
    name: 'Bybit',
    short: 'BB',
    logo: 'https://assets.coingecko.com/markets/images/698/small/bybit_spot.png',
    color: '#F7A600',
    bgColor: 'rgba(247, 166, 0, 0.1)',
  },
  okx: {
    name: 'OKX',
    short: 'OKX',
    logo: 'https://assets.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png',
    color: '#FFFFFF',
    bgColor: 'rgba(255, 255, 255, 0.1)',
  },
};

// Crypto info with logos
const CRYPTO_INFO = {
  BTC: { name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  ETH: { name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  SOL: { name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  XRP: { name: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  DOGE: { name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
  ADA: { name: 'Cardano', logo: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  AVAX: { name: 'Avalanche', logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },
  LINK: { name: 'Chainlink', logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
};

// Format price
const formatPrice = (amount, decimals = 2) => {
  if (amount === null || amount === undefined) return '—';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export default function ArbitragePortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useUser();
  const { setHeaderActions } = usePaperTradingHeader();
  const portfolioId = params.portfolio_id;
  const terminalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const [portfolio, setPortfolio] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [prices, setPrices] = useState({});
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [tickCount, setTickCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeChartIndex, setActiveChartIndex] = useState(null);
  const [timeRange, setTimeRange] = useState('ALL');

  // Check if user prefers dark mode
  const isDarkMode = profile?.theme === 'dark';

  // Fetch initial portfolio data and snapshots
  useEffect(() => {
    if (!portfolioId || !profile?.id) return;

    const fetchPortfolioData = async () => {
      // Fetch portfolio
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .eq('user_id', profile.id)
        .single();

      if (portfolioError) {
        console.error('Error fetching portfolio:', portfolioError);
        router.push('/paper-trading');
        return;
      }

      setPortfolio(portfolioData);

      // Fetch snapshots
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('snapshot_date', { ascending: true });

      if (!snapshotsError && snapshotsData) {
        setSnapshots(snapshotsData);
      }

      setLoading(false);
    };

    fetchPortfolioData();
  }, [portfolioId, profile?.id, router]);

  // Prepare chart data from snapshots
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    return snapshots.map((snapshot) => ({
      dateString: snapshot.snapshot_date,
      value: parseFloat(snapshot.total_value) || 0,
      date: new Date(snapshot.snapshot_date),
    }));
  }, [snapshots]);

  // Filter chart data based on time range
  const filteredChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    if (timeRange === 'ALL') return chartData;

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
      default:
        return chartData;
    }

    return chartData.filter((point) => point.date >= startDate);
  }, [chartData, timeRange]);

  // Calculate chart color based on performance
  const chartColor = useMemo(() => {
    if (filteredChartData.length < 2) return 'var(--color-accent)';
    const first = filteredChartData[0].value;
    const last = filteredChartData[filteredChartData.length - 1].value;
    return last >= first ? '#10b981' : '#ef4444';
  }, [filteredChartData]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (!portfolio) {
      return { currentValue: 0, change: 0, changePercent: 0 };
    }

    const startValue = parseFloat(portfolio.starting_capital) || 0;

    // If no chart data, use current_cash as the current value
    if (filteredChartData.length === 0) {
      const currentValue = parseFloat(portfolio.current_cash) || startValue;
      const change = currentValue - startValue;
      const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;
      return { currentValue, change, changePercent };
    }

    const currentValue = filteredChartData[filteredChartData.length - 1]?.value || startValue;
    const firstValue = filteredChartData[0]?.value || startValue;
    const change = currentValue - firstValue;
    const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0;
    return { currentValue, change, changePercent };
  }, [portfolio, filteredChartData]);

  // Poll prices via server-side API (avoids CORS issues)
  useEffect(() => {
    if (!portfolio) return;

    const cryptos = portfolio.crypto_assets || [];
    const exchanges = portfolio.metadata?.exchanges || [];
    if (cryptos.length === 0 || exchanges.length === 0) return;

    const fetchAllPrices = async () => {
      try {
        const res = await fetch(
          `/api/arbitrage/exchange-prices?cryptos=${cryptos.join(',')}&exchanges=${exchanges.join(',')}`
        );

        if (!res.ok) {
          setConnectionStatus('disconnected');
          return;
        }

        const data = await res.json();
        setConnectionStatus('connected');

        const newPrices = data.prices;
        const opportunities = [];

        // Calculate arbitrage opportunities
        cryptos.forEach((crypto) => {
          const cryptoPrices = newPrices[crypto] || {};
          const exchangePrices = Object.entries(cryptoPrices).filter(([_, p]) => p !== null);

          if (exchangePrices.length >= 2) {
            const sorted = exchangePrices.sort((a, b) => a[1] - b[1]);
            const [lowExchange, lowPrice] = sorted[0];
            const [highExchange, highPrice] = sorted[sorted.length - 1];
            const spread = highPrice - lowPrice;
            const spreadPercent = (spread / lowPrice) * 100;

            if (spreadPercent > 0) {
              opportunities.push({
                id: `${crypto}-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toISOString(),
                crypto,
                lowExchange,
                highExchange,
                lowPrice,
                highPrice,
                spreadPercent,
              });
            }
          }
        });

        setPrices(newPrices);
        setLastUpdate(new Date());
        setTickCount(c => c + 1);

        if (opportunities.length > 0) {
          setTerminalLogs(prev => [...opportunities, ...prev].slice(0, 100));
        }
      } catch (error) {
        console.error('Price fetch error:', error);
        setConnectionStatus('disconnected');
      }
    };

    fetchAllPrices();
    pollIntervalRef.current = setInterval(fetchAllPrices, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [portfolio]);

  // Register header actions
  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions({});
    }
  }, [setHeaderActions]);

  if (loading || !portfolio) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <ChartSkeleton className="h-80" />
            <CardSkeleton className="h-64" />
          </div>
          <div className="space-y-3">
            <CardSkeleton className="h-40" />
            <CardSkeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  const exchanges = portfolio.metadata?.exchanges || [];
  const cryptos = portfolio.crypto_assets || [];

  // Format currency for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Time range options
  const timeRanges = ['1W', '1M', '3M', 'ALL'];

  return (
    <div className="space-y-6">
      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Chart and Terminal */}
        <div className="xl:col-span-2 space-y-6">
          {/* Portfolio Value Chart */}
          <Card className="p-0 overflow-hidden">
            {/* Chart Header */}
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(performanceMetrics.currentValue)}
                  </div>
                  <div className={`text-sm font-medium ${
                    performanceMetrics.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {performanceMetrics.change >= 0 ? '+' : ''}
                    {formatCurrency(performanceMetrics.change)}
                    {' '}
                    ({performanceMetrics.changePercent >= 0 ? '+' : ''}
                    {performanceMetrics.changePercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Connection Status */}
                  <div className="flex items-center gap-2 text-xs">
                    <LuCircle className={`w-2 h-2 ${
                      connectionStatus === 'connected'
                        ? 'text-emerald-500 fill-emerald-500'
                        : connectionStatus === 'connecting'
                        ? 'text-amber-500 fill-amber-500 animate-pulse'
                        : 'text-zinc-400 fill-zinc-400'
                    }`} />
                    <span className="text-[var(--color-muted)]">
                      {connectionStatus === 'connected'
                        ? 'Live'
                        : connectionStatus === 'connecting'
                        ? 'Connecting...'
                        : 'Offline'}
                    </span>
                  </div>
                  {/* Time Range Selector */}
                  <div className="flex items-center gap-1 p-1 bg-[var(--color-border)]/20 rounded-lg">
                    {timeRanges.map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          timeRange === range
                            ? 'bg-[var(--color-surface)] text-[var(--color-fg)] shadow-sm'
                            : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="px-2 pb-4" style={{ height: '240px' }}>
              {filteredChartData.length > 1 ? (
                <LineChart
                  data={filteredChartData}
                  dataKey="value"
                  width="100%"
                  height={240}
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  strokeColor={chartColor}
                  strokeWidth={2}
                  showArea={true}
                  areaOpacity={0.15}
                  showDots={false}
                  dotRadius={4}
                  onMouseMove={(data, index) => setActiveChartIndex(index)}
                  onMouseLeave={() => setActiveChartIndex(null)}
                  showTooltip={false}
                  gradientId={`arbitrageChartGradient-${portfolio.id}`}
                  curveType="monotone"
                  xAxisDataKey="dateString"
                />
              ) : filteredChartData.length === 1 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-accent)] mb-3"></div>
                  <div className="text-sm text-[var(--color-muted)]">
                    Started {new Date(filteredChartData[0].dateString).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] opacity-60 mt-1">
                    Chart will populate as daily snapshots are recorded
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--color-muted)] text-sm">
                  No historical data available yet
                </div>
              )}
            </div>
          </Card>

          {/* Terminal - Theme Aware */}
          <div className={`rounded-xl border overflow-hidden ${
            isDarkMode
              ? 'bg-zinc-950 border-zinc-800/50'
              : 'bg-zinc-100 border-zinc-200'
          }`}>
            {/* Terminal Header */}
            <div className={`px-4 py-2 border-b flex items-center justify-between ${
              isDarkMode
                ? 'bg-zinc-900/50 border-zinc-800/50'
                : 'bg-zinc-200/50 border-zinc-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                </div>
                <span className={`text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-zinc-600'}`}>
                  arbitrage-monitor
                </span>
              </div>
              <div className={`flex items-center gap-2 text-xs ${isDarkMode ? 'text-zinc-600' : 'text-zinc-500'}`}>
                <LuRefreshCw className={`w-3 h-3 ${connectionStatus === 'connected' ? 'animate-spin-slow' : ''}`} />
                <span>{POLL_INTERVAL / 1000}s</span>
              </div>
            </div>

            {/* Terminal Content */}
            <div
              ref={terminalRef}
              className={`p-4 h-64 overflow-y-auto font-mono text-sm scrollbar-thin ${
                isDarkMode
                  ? 'scrollbar-thumb-zinc-700 scrollbar-track-transparent'
                  : 'scrollbar-thumb-zinc-300 scrollbar-track-transparent'
              }`}
            >
              {terminalLogs.length === 0 ? (
                <div className={isDarkMode ? 'text-zinc-600' : 'text-zinc-500'}>
                  <span className="text-emerald-500">$</span>
                  <span className="ml-2">
                    {connectionStatus === 'connecting'
                      ? 'Connecting to exchanges...'
                      : connectionStatus === 'connected'
                      ? 'Monitoring for arbitrage opportunities...'
                      : 'Connection lost. Retrying...'}
                  </span>
                  <span className="animate-pulse ml-1">_</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {terminalLogs.map((log) => {
                    const lowEx = EXCHANGE_INFO[log.lowExchange];
                    const highEx = EXCHANGE_INFO[log.highExchange];
                    const timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    return (
                      <div key={log.id} className={`flex items-center gap-3 py-0.5 ${
                        isDarkMode ? 'text-zinc-400' : 'text-zinc-600'
                      }`}>
                        <span className={`w-16 shrink-0 ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                          {timeStr}
                        </span>
                        <span className="text-blue-500 w-12 shrink-0">{log.crypto}</span>
                        <span className={isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}>
                          <span style={{ color: lowEx?.color }}>{lowEx?.short}</span>
                          <LuArrowRight className={`inline w-3 h-3 mx-1.5 ${
                            isDarkMode ? 'text-zinc-700' : 'text-zinc-400'
                          }`} />
                          <span style={{ color: highEx?.color }}>{highEx?.short}</span>
                        </span>
                        <span className={`font-medium ${
                          log.spreadPercent >= 0.5
                            ? 'text-emerald-500'
                            : log.spreadPercent >= 0.1
                            ? 'text-amber-500'
                            : isDarkMode ? 'text-zinc-500' : 'text-zinc-400'
                        }`}>
                          +{log.spreadPercent.toFixed(3)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Exchange Balances - Compact Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {exchanges.map((exchangeKey) => {
              const exchange = EXCHANGE_INFO[exchangeKey];
              const balance = portfolio.metadata?.capitalPerExchange || 0;

              return (
                <div
                  key={exchangeKey}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]/30"
                >
                  {exchange?.logo && (
                    <img src={exchange.logo} alt={exchangeKey} className="w-4 h-4 rounded" />
                  )}
                  <span className="text-xs text-[var(--color-muted)]">{exchange?.name}</span>
                  <span className="text-sm font-medium tabular-nums">${formatPrice(balance)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column - Crypto Price Tracker Cards */}
        <div className="space-y-3">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--color-muted)]">Exchange Prices</h3>
            {lastUpdate && connectionStatus === 'connected' && (
              <span className="text-xs text-[var(--color-muted)] opacity-60">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Crypto Price Cards */}
          {cryptos.map((crypto) => {
            const cryptoInfo = CRYPTO_INFO[crypto];
            const cryptoPrices = prices[crypto] || {};
            const exchangePrices = exchanges
              .map(ex => ({ exchange: ex, price: cryptoPrices[ex] }))
              .filter(ep => ep.price !== null && ep.price !== undefined);

            const priceValues = exchangePrices.map(ep => ep.price);
            const minPrice = priceValues.length ? Math.min(...priceValues) : null;
            const maxPrice = priceValues.length ? Math.max(...priceValues) : null;
            const spread = minPrice && maxPrice ? maxPrice - minPrice : 0;
            const spreadPercent = minPrice > 0 ? (spread / minPrice) * 100 : 0;
            const decimals = ['DOGE', 'XRP', 'ADA'].includes(crypto) ? 4 : 2;

            return (
              <div
                key={crypto}
                className="relative bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]/40 overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--color-border)]/20">
                  <div className="flex items-center gap-2.5">
                    {cryptoInfo?.logo && (
                      <img src={cryptoInfo.logo} alt={crypto} className="w-7 h-7" />
                    )}
                    <div>
                      <div className="text-sm font-semibold">{crypto}</div>
                      <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">
                        {cryptoInfo?.name}
                      </div>
                    </div>
                  </div>
                  {spreadPercent > 0.05 && (
                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      spreadPercent >= 0.5
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : spreadPercent >= 0.1
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-[var(--color-border)]/30 text-[var(--color-muted)]'
                    }`}>
                      <LuTrendingUp className="w-3 h-3" />
                      <span>{spreadPercent.toFixed(2)}%</span>
                    </div>
                  )}
                </div>

                {/* Exchange Prices */}
                <div className="p-3 space-y-1.5">
                  {exchanges.map((exchangeKey) => {
                    const exchange = EXCHANGE_INFO[exchangeKey];
                    const price = cryptoPrices[exchangeKey];
                    const isMin = price === minPrice && exchangePrices.length > 1 && spreadPercent > 0.01;
                    const isMax = price === maxPrice && exchangePrices.length > 1 && spreadPercent > 0.01;

                    return (
                      <div
                        key={exchangeKey}
                        className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
                          isMin ? 'bg-emerald-500/8' : isMax ? 'bg-rose-500/8' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {exchange?.logo && (
                            <img src={exchange.logo} alt={exchangeKey} className="w-5 h-5 rounded" />
                          )}
                          <span className="text-xs font-medium text-[var(--color-muted)]">
                            {exchange?.name}
                          </span>
                          {isMin && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 uppercase tracking-wider">
                              Buy
                            </span>
                          )}
                          {isMax && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 uppercase tracking-wider">
                              Sell
                            </span>
                          )}
                        </div>
                        <AnimatedPrice
                          value={price}
                          className={`text-sm font-mono tabular-nums font-medium ${
                            isMin ? 'text-emerald-500' : isMax ? 'text-rose-500' : ''
                          }`}
                          decimals={decimals}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slow spin animation for refresh icon */}
      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
