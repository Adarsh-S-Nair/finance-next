"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "../../../../../components/ui/Card";
import {
  LuArrowRight,
  LuZap,
  LuTerminal,
  LuCircle,
  LuTrendingUp,
  LuTrendingDown,
} from "react-icons/lu";
import { useUser } from "../../../../../components/UserProvider";
import { supabase } from "../../../../../lib/supabaseClient";
import { usePaperTradingHeader } from "../../PaperTradingHeaderContext";
import { CardSkeleton } from "../../../../../components/ui/Skeleton";

// Polling interval (5 seconds)
const POLL_INTERVAL = 5000;

// Animated price component with shake effect on update
const AnimatedPrice = ({ value, prefix = "$", decimals = 2, className = "" }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [animate, setAnimate] = useState(false);
  const [direction, setDirection] = useState(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current && prevValueRef.current !== null && value !== null) {
      const isUp = value > prevValueRef.current;
      setDirection(isUp ? 'up' : 'down');
      setAnimate(true);
      setDisplayValue(value);

      const timer = setTimeout(() => {
        setAnimate(false);
        setDirection(null);
      }, 500);
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
        inline-block
        transition-all duration-150
        ${animate ? 'animate-price-shake' : ''}
        ${direction === 'up' ? 'text-emerald-500' : ''}
        ${direction === 'down' ? 'text-rose-500' : ''}
      `}
      style={{
        textShadow: direction === 'up'
          ? '0 0 12px rgba(16, 185, 129, 0.6)'
          : direction === 'down'
          ? '0 0 12px rgba(244, 63, 94, 0.6)'
          : 'none',
      }}
    >
      {formatted}
    </span>
  );
};

// Exchange info with logos and API endpoints
const EXCHANGE_INFO = {
  coinbase: {
    name: 'Coinbase',
    short: 'CB',
    logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png',
    color: '#0052FF',
    // Coinbase API: /v2/prices/{symbol}-USD/spot
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`);
        if (!res.ok) return null;
        const data = await res.json();
        return parseFloat(data.data.amount);
      } catch {
        return null;
      }
    },
  },
  binance: {
    name: 'Binance',
    short: 'BIN',
    logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg',
    color: '#F0B90B',
    // Binance API: /api/v3/ticker/price?symbol={symbol}USDT
    fetchPrice: async (symbol) => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
        if (!res.ok) return null;
        const data = await res.json();
        return parseFloat(data.price);
      } catch {
        return null;
      }
    },
  },
  kraken: {
    name: 'Kraken',
    short: 'KRK',
    logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg',
    color: '#5741D9',
    // Kraken API: /0/public/Ticker?pair={symbol}USD
    fetchPrice: async (symbol) => {
      try {
        // Kraken uses different symbols for some cryptos
        const krakenSymbol = symbol === 'BTC' ? 'XBT' : symbol;
        const pair = `${krakenSymbol}USD`;
        const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.error && data.error.length > 0) return null;
        // Kraken returns prices in result object with pair as key
        const resultKey = Object.keys(data.result)[0];
        if (!resultKey) return null;
        return parseFloat(data.result[resultKey].c[0]); // 'c' is last trade closed [price, volume]
      } catch {
        return null;
      }
    },
  },
};

// Crypto info with logos
const CRYPTO_INFO = {
  BTC: {
    name: 'Bitcoin',
    logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    productId: 'BTC-USD',
  },
  ETH: {
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    productId: 'ETH-USD',
  },
  SOL: {
    name: 'Solana',
    logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    productId: 'SOL-USD',
  },
  XRP: {
    name: 'XRP',
    logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    productId: 'XRP-USD',
  },
  DOGE: {
    name: 'Dogecoin',
    logo: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    productId: 'DOGE-USD',
  },
  ADA: {
    name: 'Cardano',
    logo: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    productId: 'ADA-USD',
  },
  AVAX: {
    name: 'Avalanche',
    logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    productId: 'AVAX-USD',
  },
  LINK: {
    name: 'Chainlink',
    logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    productId: 'LINK-USD',
  },
};

// Format price
const formatPrice = (amount, decimals = 2) => {
  if (amount === null || amount === undefined) return '—';
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Terminal log entry - shows arbitrage opportunity
const TerminalEntry = ({ timestamp, crypto, exchanges, spread, spreadPercent }) => {
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const cryptoInfo = CRYPTO_INFO[crypto];
  const lowExchange = EXCHANGE_INFO[exchanges.low];
  const highExchange = EXCHANGE_INFO[exchanges.high];

  return (
    <div className="font-mono text-xs leading-relaxed flex items-center gap-2 py-0.5 flex-wrap">
      <span className="text-[var(--color-muted)] opacity-60">{timeStr}</span>
      {cryptoInfo?.logo && (
        <img src={cryptoInfo.logo} alt={crypto} className="w-4 h-4 rounded-full" />
      )}
      <span className="text-blue-500 dark:text-blue-400 w-12">{crypto}</span>
      <span className="text-[var(--color-muted)]">buy</span>
      <span style={{ color: lowExchange?.color }}>{lowExchange?.short}</span>
      <span className="text-[var(--color-muted)]">→</span>
      <span className="text-[var(--color-muted)]">sell</span>
      <span style={{ color: highExchange?.color }}>{highExchange?.short}</span>
      <span className={spreadPercent >= 0.5 ? 'text-emerald-500' : spreadPercent >= 0.1 ? 'text-amber-500' : 'text-[var(--color-muted)]'}>
        +{spreadPercent.toFixed(3)}%
      </span>
    </div>
  );
};

export default function ArbitragePortfolioPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useUser();
  const { setHeaderActions } = usePaperTradingHeader();
  const portfolioId = params.portfolio_id;
  const terminalRef = useRef(null);
  const prevPricesRef = useRef({});
  const pollIntervalRef = useRef(null);

  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [prices, setPrices] = useState({}); // { BTC: { coinbase: 100000, binance: 100050, kraken: 99980 }, ... }
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [tickCount, setTickCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch initial portfolio data
  useEffect(() => {
    if (!portfolioId || !profile?.id) return;

    const fetchPortfolio = async () => {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .eq('user_id', profile.id)
        .single();

      if (error) {
        console.error('Error fetching portfolio:', error);
        router.push('/paper-trading');
        return;
      }

      setPortfolio(data);
      setLoading(false);
    };

    fetchPortfolio();
  }, [portfolioId, profile?.id, router]);

  // Poll prices from multiple exchanges
  useEffect(() => {
    if (!portfolio) return;

    const cryptos = portfolio.crypto_assets || [];
    const exchanges = portfolio.metadata?.exchanges || [];
    if (cryptos.length === 0 || exchanges.length === 0) return;

    const fetchAllPrices = async () => {
      console.log('[POLL] Fetching prices from exchanges...');
      setConnectionStatus('connected');

      const newPrices = {};
      const opportunities = [];

      // Fetch prices for each crypto from each exchange
      await Promise.all(
        cryptos.map(async (crypto) => {
          newPrices[crypto] = {};

          await Promise.all(
            exchanges.map(async (exchangeKey) => {
              const exchange = EXCHANGE_INFO[exchangeKey];
              if (exchange?.fetchPrice) {
                const price = await exchange.fetchPrice(crypto);
                if (price !== null) {
                  newPrices[crypto][exchangeKey] = price;
                }
              }
            })
          );

          // Calculate arbitrage opportunity for this crypto
          const exchangePrices = Object.entries(newPrices[crypto]).filter(([_, p]) => p !== null);
          if (exchangePrices.length >= 2) {
            const sorted = exchangePrices.sort((a, b) => a[1] - b[1]);
            const [lowExchange, lowPrice] = sorted[0];
            const [highExchange, highPrice] = sorted[sorted.length - 1];
            const spread = highPrice - lowPrice;
            const spreadPercent = (spread / lowPrice) * 100;

            if (spreadPercent > 0) {
              opportunities.push({
                id: `${crypto}-${Date.now()}`,
                timestamp: new Date().toISOString(),
                crypto,
                exchanges: { low: lowExchange, high: highExchange },
                lowPrice,
                highPrice,
                spread,
                spreadPercent,
              });
            }
          }
        })
      );

      console.log('[POLL] Prices fetched:', newPrices);
      console.log('[POLL] Opportunities:', opportunities);

      setPrices(newPrices);
      setLastUpdate(new Date());
      setTickCount(c => c + 1);

      // Add opportunities to terminal log
      if (opportunities.length > 0) {
        setTerminalLogs(prev => [...opportunities, ...prev].slice(0, 50));
      }
    };

    // Fetch immediately
    fetchAllPrices();

    // Set up polling interval
    pollIntervalRef.current = setInterval(fetchAllPrices, POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      console.log('[POLL] Cleaning up polling interval');
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
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-48" />
      </div>
    );
  }

  const exchanges = portfolio.metadata?.exchanges || [];
  const cryptos = portfolio.crypto_assets || [];

  return (
    <div className="space-y-6">
      {/* CSS for shake animation */}
      <style jsx global>{`
        @keyframes price-shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-3px); }
          30%, 60%, 90% { transform: translateX(3px); }
        }
        .animate-price-shake {
          animation: price-shake 0.3s ease-in-out;
        }
      `}</style>

      {/* Stats Row */}
      <div className="flex items-center gap-6 text-sm flex-wrap">
        <div>
          <span className="text-[var(--color-muted)]">Capital</span>
          <span className="ml-2 text-[var(--color-fg)] tabular-nums">${formatPrice(portfolio.current_cash)}</span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Exchanges</span>
          <span className="ml-2 text-[var(--color-fg)]">{exchanges.length}</span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Assets</span>
          <span className="ml-2 text-[var(--color-fg)]">{cryptos.length}</span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Updates</span>
          <span className="ml-2 text-[var(--color-fg)] tabular-nums">{tickCount}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <LuCircle className={`w-2 h-2 ${
            connectionStatus === 'connected'
              ? 'text-emerald-500 fill-emerald-500'
              : connectionStatus === 'connecting'
              ? 'text-amber-500 fill-amber-500 animate-pulse'
              : 'text-zinc-400'
          }`} />
          <span>
            {connectionStatus === 'connected'
              ? `Live • ${lastUpdate ? lastUpdate.toLocaleTimeString() : '...'}`
              : connectionStatus === 'connecting'
              ? 'Fetching...'
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Price Grid - Multi-Exchange */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cryptos.map((crypto) => {
          const cryptoInfo = CRYPTO_INFO[crypto];
          const cryptoPrices = prices[crypto] || {};
          const exchangePrices = exchanges
            .map(ex => ({ exchange: ex, price: cryptoPrices[ex] }))
            .filter(ep => ep.price !== null && ep.price !== undefined);

          // Find min/max for highlighting
          const priceValues = exchangePrices.map(ep => ep.price);
          const minPrice = Math.min(...priceValues);
          const maxPrice = Math.max(...priceValues);
          const spread = maxPrice - minPrice;
          const spreadPercent = minPrice > 0 ? (spread / minPrice) * 100 : 0;
          const decimals = crypto === 'DOGE' || crypto === 'XRP' || crypto === 'ADA' ? 4 : 2;

          return (
            <Card key={crypto} variant="glass" padding="none" className="overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--color-border)]/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {cryptoInfo?.logo && (
                    <img src={cryptoInfo.logo} alt={crypto} className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-[var(--color-fg)]">{crypto}</div>
                    <div className="text-xs text-[var(--color-muted)]">{cryptoInfo?.name}</div>
                  </div>
                </div>
                {spreadPercent > 0 && (
                  <div className={`text-xs font-mono px-2 py-1 rounded ${
                    spreadPercent >= 0.5 ? 'bg-emerald-500/20 text-emerald-500' :
                    spreadPercent >= 0.1 ? 'bg-amber-500/20 text-amber-500' :
                    'bg-zinc-500/20 text-[var(--color-muted)]'
                  }`}>
                    {spreadPercent >= 0.1 ? <LuTrendingUp className="inline w-3 h-3 mr-1" /> : null}
                    {spreadPercent.toFixed(3)}% spread
                  </div>
                )}
              </div>

              {/* Exchange Prices */}
              <div className="px-4 py-2 space-y-1">
                {exchanges.map((exchangeKey) => {
                  const exchange = EXCHANGE_INFO[exchangeKey];
                  const price = cryptoPrices[exchangeKey];
                  const isMin = price === minPrice && exchangePrices.length > 1;
                  const isMax = price === maxPrice && exchangePrices.length > 1;

                  return (
                    <div key={exchangeKey} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        {exchange?.logo && (
                          <img src={exchange.logo} alt={exchangeKey} className="w-4 h-4 rounded" />
                        )}
                        <span className="text-xs text-[var(--color-muted)]">{exchange?.name}</span>
                        {isMin && <span className="text-[10px] px-1 rounded bg-emerald-500/20 text-emerald-500">BUY</span>}
                        {isMax && <span className="text-[10px] px-1 rounded bg-rose-500/20 text-rose-500">SELL</span>}
                      </div>
                      <AnimatedPrice
                        value={price}
                        className={`text-sm font-mono tabular-nums ${
                          isMin ? 'text-emerald-500' : isMax ? 'text-rose-500' : 'text-[var(--color-fg)]'
                        }`}
                        decimals={decimals}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Terminal Feed - Arbitrage Opportunities */}
      <Card variant="glass" padding="none" className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]/20 flex items-center gap-2">
          <LuTerminal className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-fg)]">Arbitrage Opportunities</span>
          <span className="text-xs text-[var(--color-muted)]">— polling every {POLL_INTERVAL / 1000}s</span>
        </div>
        <div
          ref={terminalRef}
          className="p-4 bg-[var(--color-surface)] h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border)]"
        >
          {terminalLogs.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] font-mono">
              $ {connectionStatus === 'connecting' ? 'fetching prices from exchanges...' :
                 connectionStatus === 'connected' ? 'waiting for arbitrage opportunities...' :
                 'disconnected'}
            </div>
          ) : (
            <div className="space-y-0">
              {terminalLogs.map((log) => (
                <TerminalEntry key={log.id} {...log} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Exchange Balances */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {exchanges.map((exchangeKey) => {
          const exchange = EXCHANGE_INFO[exchangeKey];
          const balance = portfolio.metadata?.capitalPerExchange || 0;

          return (
            <Card key={exchangeKey} variant="glass" padding="none" className="p-3">
              <div className="flex items-center gap-2 mb-1">
                {exchange?.logo && (
                  <img src={exchange.logo} alt={exchangeKey} className="w-4 h-4 rounded" />
                )}
                <span className="text-xs text-[var(--color-muted)]">{exchange?.name || exchangeKey}</span>
              </div>
              <div className="text-sm text-[var(--color-fg)] tabular-nums">
                ${formatPrice(balance)}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
