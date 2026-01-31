"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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

// Animated price component with flash effect
const AnimatedPrice = ({ value, prefix = "$", decimals = 2, className = "" }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [flash, setFlash] = useState(null); // 'up' | 'down' | null
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current && prevValueRef.current !== null) {
      const isUp = value > prevValueRef.current;
      setFlash(isUp ? 'up' : 'down');
      setDisplayValue(value);

      const timer = setTimeout(() => setFlash(null), 600);
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
        transition-all duration-300 ease-out
        ${flash === 'up' ? 'text-emerald-500 scale-105' : ''}
        ${flash === 'down' ? 'text-rose-500 scale-105' : ''}
      `}
      style={{
        textShadow: flash === 'up'
          ? '0 0 8px rgba(16, 185, 129, 0.5)'
          : flash === 'down'
          ? '0 0 8px rgba(244, 63, 94, 0.5)'
          : 'none',
      }}
    >
      {formatted}
    </span>
  );
};

// Exchange info with logos
const EXCHANGE_INFO = {
  binance: {
    name: 'Binance',
    short: 'BIN',
    logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg',
    color: '#F0B90B'
  },
  coinbase: {
    name: 'Coinbase',
    short: 'CB',
    logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png',
    color: '#0052FF'
  },
  kraken: {
    name: 'Kraken',
    short: 'KRK',
    logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg',
    color: '#5741D9'
  },
  kucoin: {
    name: 'KuCoin',
    short: 'KUC',
    logo: 'https://assets.coingecko.com/markets/images/61/small/kucoin.png',
    color: '#23AF91'
  },
  bybit: {
    name: 'Bybit',
    short: 'BYB',
    logo: 'https://assets.coingecko.com/markets/images/698/small/bybit_spot.png',
    color: '#F7A600'
  },
  okx: {
    name: 'OKX',
    short: 'OKX',
    logo: 'https://assets.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png',
    color: '#000000'
  },
};

// Crypto info with logos
const CRYPTO_INFO = {
  BTC: {
    name: 'Bitcoin',
    logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    color: '#F7931A'
  },
  ETH: {
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    color: '#627EEA'
  },
  SOL: {
    name: 'Solana',
    logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
    color: '#00FFA3'
  },
  XRP: {
    name: 'XRP',
    logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
    color: '#23292F'
  },
  DOGE: {
    name: 'Dogecoin',
    logo: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
    color: '#C2A633'
  },
  ADA: {
    name: 'Cardano',
    logo: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
    color: '#0033AD'
  },
  AVAX: {
    name: 'Avalanche',
    logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    color: '#E84142'
  },
  LINK: {
    name: 'Chainlink',
    logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
    color: '#375BD2'
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

// Format percentage
const formatPercent = (value) => {
  if (value === null || value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(3)}%`;
};

// Terminal log entry with logos (theme-aware)
const TerminalEntry = ({ timestamp, crypto, exchange, price, isLowest, isHighest, spreadPercent }) => {
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const cryptoInfo = CRYPTO_INFO[crypto];
  const exchangeInfo = EXCHANGE_INFO[exchange];
  const exchangeShort = exchangeInfo?.short || exchange?.toUpperCase().slice(0, 3) || '???';

  return (
    <div className="font-mono text-xs leading-relaxed flex items-center gap-2 py-0.5">
      <span className="text-[var(--color-muted)] opacity-60">{timeStr}</span>
      {cryptoInfo?.logo && (
        <img src={cryptoInfo.logo} alt={crypto} className="w-4 h-4 rounded-full" />
      )}
      <span className="text-blue-500 dark:text-blue-400">{crypto}</span>
      {exchangeInfo?.logo && (
        <img src={exchangeInfo.logo} alt={exchange} className="w-4 h-4 rounded" />
      )}
      <span className="text-[var(--color-muted)]">{exchangeShort}</span>
      <span className={
        isLowest ? 'text-emerald-600 dark:text-emerald-400' :
        isHighest ? 'text-rose-600 dark:text-rose-400' :
        'text-[var(--color-fg)]'
      }>
        ${formatPrice(price)}
      </span>
      {isLowest && <span className="text-emerald-600 dark:text-emerald-500 text-[10px] opacity-70">LOW</span>}
      {isHighest && <span className="text-rose-600 dark:text-rose-500 text-[10px] opacity-70">HIGH</span>}
      {spreadPercent > 0.3 && isLowest && (
        <span className="text-amber-600 dark:text-amber-400 text-[10px]">Δ{formatPercent(spreadPercent)}</span>
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

  const [portfolio, setPortfolio] = useState(null);
  const [pricesData, setPricesData] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isLive, setIsLive] = useState(true);
  // Track live prices from feed (crypto -> exchange -> price)
  const [livePrices, setLivePrices] = useState({});

  // Fetch portfolio and set up realtime subscription
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

      // Extract prices from metadata (stored by the engine)
      if (data?.metadata?.latestPrices) {
        setPricesData(data.metadata.latestPrices);
        setOpportunities(data.metadata.latestOpportunities || []);
        if (data.metadata.lastPriceUpdate) {
          setLastUpdated(new Date(data.metadata.lastPriceUpdate));
        }
      }

      setLoading(false);
    };

    fetchPortfolio();

    // Subscribe to portfolio updates (for price data from engine)
    const portfolioChannel = supabase
      .channel(`portfolio-${portfolioId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'portfolios',
          filter: `id=eq.${portfolioId}`,
        },
        (payload) => {
          const newData = payload.new;
          setPortfolio(newData);

          if (newData?.metadata?.latestPrices) {
            setPricesData(newData.metadata.latestPrices);
            setOpportunities(newData.metadata.latestOpportunities || []);
            if (newData.metadata.lastPriceUpdate) {
              setLastUpdated(new Date(newData.metadata.lastPriceUpdate));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(portfolioChannel);
    };
  }, [portfolioId, profile?.id, router]);

  // Fetch historical price logs and subscribe to new ones
  useEffect(() => {
    if (!portfolioId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('arbitrage_price_history')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setTerminalLogs(data.map(row => ({
          id: row.id,
          timestamp: row.created_at,
          crypto: row.crypto,
          exchange: row.exchange,
          price: row.price,
          isLowest: row.is_lowest,
          isHighest: row.is_highest,
          spreadPercent: row.spread_percent,
        })));

        // Build initial live prices from history (most recent per crypto/exchange)
        const initialLivePrices = {};
        data.forEach(row => {
          if (!initialLivePrices[row.crypto]) {
            initialLivePrices[row.crypto] = {};
          }
          // Only set if not already set (first occurrence is most recent due to ordering)
          if (!initialLivePrices[row.crypto][row.exchange]) {
            initialLivePrices[row.crypto][row.exchange] = row.price;
          }
        });
        setLivePrices(initialLivePrices);
      }
    };

    fetchHistory();

    // Subscribe to new price history entries
    const historyChannel = supabase
      .channel(`price-history-${portfolioId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arbitrage_price_history',
          filter: `portfolio_id=eq.${portfolioId}`,
        },
        (payload) => {
          const row = payload.new;
          setTerminalLogs(prev => [{
            id: row.id,
            timestamp: row.created_at,
            crypto: row.crypto,
            exchange: row.exchange,
            price: row.price,
            isLowest: row.is_lowest,
            isHighest: row.is_highest,
            spreadPercent: row.spread_percent,
          }, ...prev].slice(0, 100));

          // Update live prices with this new price
          setLivePrices(prev => ({
            ...prev,
            [row.crypto]: {
              ...prev[row.crypto],
              [row.exchange]: row.price,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(historyChannel);
    };
  }, [portfolioId]);

  // Register header actions
  useEffect(() => {
    if (setHeaderActions) {
      setHeaderActions({
        onSettingsClick: () => {
          // TODO: Settings modal
        },
      });
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
        {opportunities.length > 0 && (
          <div>
            <span className="text-[var(--color-muted)]">Opportunities</span>
            <span className="ml-2 text-emerald-500">{opportunities.length}</span>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <LuCircle className={`w-2 h-2 ${isLive ? 'text-emerald-500 fill-emerald-500 animate-pulse' : 'text-zinc-400'}`} />
          <span>{isLive ? 'Live from server' : 'Disconnected'}</span>
        </div>
        {lastUpdated && (
          <span className="text-xs text-[var(--color-muted)]">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Active Opportunities */}
      {opportunities.length > 0 && (
        <Card variant="glass" padding="none" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <LuZap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-[var(--color-fg)]">Active Opportunities</span>
          </div>
          <div className="space-y-2">
            {opportunities.map((opp, idx) => (
              <div
                key={`${opp.crypto}-${idx}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--color-surface)]/50"
              >
                <div className="flex items-center gap-3">
                  {CRYPTO_INFO[opp.crypto]?.logo && (
                    <img
                      src={CRYPTO_INFO[opp.crypto].logo}
                      alt={opp.crypto}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-sm text-[var(--color-fg)]">{opp.crypto}</span>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                    {EXCHANGE_INFO[opp.buyExchange]?.logo && (
                      <img
                        src={EXCHANGE_INFO[opp.buyExchange].logo}
                        alt={opp.buyExchange}
                        className="w-4 h-4 rounded"
                      />
                    )}
                    <span>{EXCHANGE_INFO[opp.buyExchange]?.name}</span>
                    <LuArrowRight className="w-3 h-3" />
                    {EXCHANGE_INFO[opp.sellExchange]?.logo && (
                      <img
                        src={EXCHANGE_INFO[opp.sellExchange].logo}
                        alt={opp.sellExchange}
                        className="w-4 h-4 rounded"
                      />
                    )}
                    <span>{EXCHANGE_INFO[opp.sellExchange]?.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm tabular-nums">
                  <span className="text-emerald-500">{formatPercent(opp.spreadPercent)}</span>
                  <span className="text-[var(--color-fg)]">${formatPrice(opp.spreadUsd)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Price Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cryptos.map((crypto) => {
          const cryptoData = pricesData?.[crypto];
          const cryptoInfo = CRYPTO_INFO[crypto];

          if (!cryptoData) {
            return (
              <Card key={crypto} variant="glass" padding="none" className="p-4">
                <div className="flex items-center gap-2 text-[var(--color-muted)] text-sm">
                  {cryptoInfo?.logo && (
                    <img src={cryptoInfo.logo} alt={crypto} className="w-5 h-5 rounded-full opacity-50" />
                  )}
                  Waiting for {crypto} data...
                </div>
              </Card>
            );
          }

          // Merge metadata prices with live prices (live takes precedence)
          const cryptoLivePrices = livePrices[crypto] || {};
          const exchangePrices = Object.entries(cryptoData.prices || {})
            .map(([key, data]) => ({
              key,
              ...data,
              // Use live price if available, otherwise fall back to metadata price
              price: cryptoLivePrices[key] !== undefined ? cryptoLivePrices[key] : data.price,
            }))
            .filter(e => e.price)
            .sort((a, b) => a.price - b.price);

          const lowestPrice = exchangePrices[0]?.price;
          const highestPrice = exchangePrices[exchangePrices.length - 1]?.price;
          const spread = {
            percent: cryptoData.spreadPercent,
            usd: cryptoData.spreadUsd,
          };

          return (
            <Card key={crypto} variant="glass" padding="none" className="overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--color-border)]/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {cryptoInfo?.logo && (
                    <img src={cryptoInfo.logo} alt={crypto} className="w-6 h-6 rounded-full" />
                  )}
                  <div>
                    <span className="text-sm text-[var(--color-fg)]">{crypto}</span>
                    <span className="text-xs text-[var(--color-muted)] ml-2">{cryptoInfo?.name}</span>
                  </div>
                </div>
                {spread.percent && (
                  <span className={`text-sm tabular-nums ${spread.percent > 0.5 ? 'text-emerald-500' : 'text-[var(--color-muted)]'}`}>
                    {formatPercent(spread.percent)}
                  </span>
                )}
              </div>

              {/* Exchange Prices */}
              <div className="divide-y divide-[var(--color-border)]/10">
                {exchangePrices.map((exchangeData) => {
                  const exchangeInfo = EXCHANGE_INFO[exchangeData.key];
                  const isLowest = exchangeData.price === lowestPrice;
                  const isHighest = exchangeData.price === highestPrice;

                  return (
                    <div
                      key={exchangeData.key}
                      className={`px-4 py-2 flex items-center justify-between ${
                        isLowest ? 'bg-emerald-500/5' : isHighest ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {exchangeInfo?.logo && (
                          <img src={exchangeInfo.logo} alt={exchangeData.key} className="w-5 h-5 rounded" />
                        )}
                        <span className="text-sm text-[var(--color-fg)]">
                          {exchangeInfo?.name}
                        </span>
                        {isLowest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                            BUY
                          </span>
                        )}
                        {isHighest && exchangePrices.length > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">
                            SELL
                          </span>
                        )}
                      </div>
                      <AnimatedPrice
                        value={exchangeData.price}
                        className={`text-sm tabular-nums ${
                          isLowest ? 'text-emerald-500' : isHighest ? 'text-rose-500' : 'text-[var(--color-fg)]'
                        }`}
                      />
                    </div>
                  );
                })}

                {exchangePrices.length === 0 && (
                  <div className="p-4 text-center text-[var(--color-muted)] text-sm">
                    No price data
                  </div>
                )}
              </div>

              {/* Arbitrage Summary */}
              {spread.percent > 0.1 && cryptoData.bestBuy && cryptoData.bestSell && (
                <div className="px-4 py-2.5 border-t border-[var(--color-border)]/20 bg-[var(--color-surface)]/30">
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-emerald-500 tabular-nums">
                      ${formatPrice(cryptoData.bestBuy.price)}
                    </span>
                    <LuArrowRight className="w-3 h-3 text-[var(--color-muted)]" />
                    <span className="text-rose-500 tabular-nums">
                      ${formatPrice(cryptoData.bestSell.price)}
                    </span>
                    <span className="text-[var(--color-muted)]">=</span>
                    <span className="text-[var(--color-fg)] tabular-nums">
                      ${formatPrice(spread.usd)}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Terminal Feed - Theme Aware */}
      <Card variant="glass" padding="none" className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]/20 flex items-center gap-2">
          <LuTerminal className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-fg)]">Price Feed</span>
          <span className="text-xs text-[var(--color-muted)]">— live from server</span>
        </div>
        <div
          ref={terminalRef}
          className="p-4 bg-[var(--color-surface)] h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border)]"
        >
          {terminalLogs.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] font-mono">
              $ connecting to price feed...
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
                <span className="text-xs text-[var(--color-muted)]">{exchange?.name}</span>
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
