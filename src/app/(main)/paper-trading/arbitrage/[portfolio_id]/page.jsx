"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "../../../../../components/ui/Card";
import {
  LuArrowRight,
  LuZap,
  LuTerminal,
  LuCircle,
} from "react-icons/lu";
import { useUser } from "../../../../../components/UserProvider";
import { supabase } from "../../../../../lib/supabaseClient";
import { usePaperTradingHeader } from "../../PaperTradingHeaderContext";
import { CardSkeleton } from "../../../../../components/ui/Skeleton";

// Coinbase WebSocket URL
const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";

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

// Exchange info with logos
const EXCHANGE_INFO = {
  coinbase: {
    name: 'Coinbase',
    short: 'CB',
    logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png',
    color: '#0052FF'
  },
  binance: {
    name: 'Binance',
    short: 'BIN',
    logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg',
    color: '#F0B90B'
  },
  kraken: {
    name: 'Kraken',
    short: 'KRK',
    logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg',
    color: '#5741D9'
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

// Terminal log entry
const TerminalEntry = ({ timestamp, crypto, price, direction }) => {
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const cryptoInfo = CRYPTO_INFO[crypto];

  return (
    <div className="font-mono text-xs leading-relaxed flex items-center gap-2 py-0.5">
      <span className="text-[var(--color-muted)] opacity-60">{timeStr}</span>
      {cryptoInfo?.logo && (
        <img src={cryptoInfo.logo} alt={crypto} className="w-4 h-4 rounded-full" />
      )}
      <span className="text-blue-500 dark:text-blue-400 w-12">{crypto}</span>
      <span className={direction === 'up' ? 'text-emerald-500' : direction === 'down' ? 'text-rose-500' : 'text-[var(--color-fg)]'}>
        ${formatPrice(price)}
      </span>
      {direction && (
        <span className={direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}>
          {direction === 'up' ? '▲' : '▼'}
        </span>
      )}
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
  const wsRef = useRef(null);
  const prevPricesRef = useRef({});

  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [prices, setPrices] = useState({});
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [tickCount, setTickCount] = useState(0);

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

  // Connect to Coinbase WebSocket for live prices
  useEffect(() => {
    if (!portfolio) return;

    const cryptos = portfolio.crypto_assets || [];
    if (cryptos.length === 0) return;

    // Map crypto symbols to Coinbase product IDs
    const productIds = cryptos
      .map(crypto => CRYPTO_INFO[crypto]?.productId)
      .filter(Boolean);

    if (productIds.length === 0) return;

    console.log('[WS] Connecting to Coinbase WebSocket...');
    setConnectionStatus('connecting');

    const ws = new WebSocket(COINBASE_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected! Subscribing to:', productIds);
      setConnectionStatus('connected');

      const subscribeMsg = {
        type: 'subscribe',
        product_ids: productIds,
        channels: ['ticker'],
      };
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'ticker') {
        const { product_id, price } = data;
        const numPrice = parseFloat(price);
        const crypto = product_id.replace('-USD', '');

        // Determine price direction
        const prevPrice = prevPricesRef.current[crypto];
        const direction = prevPrice ? (numPrice > prevPrice ? 'up' : numPrice < prevPrice ? 'down' : null) : null;
        prevPricesRef.current[crypto] = numPrice;

        console.log(`[PRICE] ${crypto}: $${numPrice.toLocaleString()}`);

        // Update prices state
        setPrices(prev => ({
          ...prev,
          [crypto]: numPrice,
        }));

        // Add to terminal logs
        setTerminalLogs(prev => [{
          id: `${crypto}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          crypto,
          price: numPrice,
          direction,
        }, ...prev].slice(0, 50));

        setTickCount(c => c + 1);
      } else if (data.type === 'subscriptions') {
        console.log('[WS] Subscribed to channels:', data.channels);
      } else if (data.type === 'error') {
        console.error('[WS] Error:', data.message);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] WebSocket error:', error);
      setConnectionStatus('error');
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected. Code:', event.code);
      setConnectionStatus('disconnected');
    };

    // Cleanup on unmount
    return () => {
      console.log('[WS] Cleaning up WebSocket connection');
      if (wsRef.current) {
        wsRef.current.close();
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
          <span className="text-[var(--color-muted)]">Ticks</span>
          <span className="ml-2 text-[var(--color-fg)] tabular-nums">{tickCount}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <LuCircle className={`w-2 h-2 ${
            connectionStatus === 'connected'
              ? 'text-emerald-500 fill-emerald-500 animate-pulse'
              : connectionStatus === 'connecting'
              ? 'text-amber-500 fill-amber-500 animate-pulse'
              : 'text-zinc-400'
          }`} />
          <span>
            {connectionStatus === 'connected' ? 'Live' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             'Disconnected'}
          </span>
        </div>
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cryptos.map((crypto) => {
          const cryptoInfo = CRYPTO_INFO[crypto];
          const price = prices[crypto];

          return (
            <Card key={crypto} variant="glass" padding="none" className="overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {cryptoInfo?.logo && (
                    <img src={cryptoInfo.logo} alt={crypto} className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-[var(--color-fg)]">{crypto}</div>
                    <div className="text-xs text-[var(--color-muted)]">{cryptoInfo?.name}</div>
                  </div>
                </div>
                <AnimatedPrice
                  value={price}
                  className="text-lg font-mono tabular-nums text-[var(--color-fg)]"
                  decimals={crypto === 'DOGE' || crypto === 'XRP' || crypto === 'ADA' ? 4 : 2}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Terminal Feed */}
      <Card variant="glass" padding="none" className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]/20 flex items-center gap-2">
          <LuTerminal className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-fg)]">Live Price Feed</span>
          <span className="text-xs text-[var(--color-muted)]">— Coinbase WebSocket</span>
        </div>
        <div
          ref={terminalRef}
          className="p-4 bg-[var(--color-surface)] h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border)]"
        >
          {terminalLogs.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] font-mono">
              $ {connectionStatus === 'connecting' ? 'connecting to price stream...' :
                 connectionStatus === 'connected' ? 'waiting for price updates...' :
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
