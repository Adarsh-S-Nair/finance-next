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

// Arbitrage opportunity entry for terminal (theme-aware)
const OpportunityEntry = ({ timestamp, crypto, buyExchange, sellExchange, buyPrice, sellPrice, amount, profit, profitPercent, fees, status }) => {
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const cryptoInfo = CRYPTO_INFO[crypto];
  const buyExchangeInfo = EXCHANGE_INFO[buyExchange];
  const sellExchangeInfo = EXCHANGE_INFO[sellExchange];

  const statusColors = {
    detected: 'text-amber-500',
    executed: 'text-emerald-500',
    missed: 'text-[var(--color-muted)]',
  };

  return (
    <div className="font-mono text-xs leading-relaxed py-1.5 border-b border-[var(--color-border)]/10 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-muted)] opacity-60 w-16">{timeStr}</span>
        <span className={`text-[10px] uppercase font-medium ${statusColors[status] || statusColors.detected}`}>
          {status || 'detected'}
        </span>
        {cryptoInfo?.logo && (
          <img src={cryptoInfo.logo} alt={crypto} className="w-4 h-4 rounded-full" />
        )}
        <span className="text-[var(--color-accent)]">{crypto}</span>
        <span className="text-emerald-500">+{formatPercent(profitPercent)}</span>
      </div>
      <div className="flex items-center gap-2 mt-1 ml-16 text-[11px]">
        <span className="text-emerald-500">BUY</span>
        {buyExchangeInfo?.logo && (
          <img src={buyExchangeInfo.logo} alt={buyExchange} className="w-3.5 h-3.5 rounded" />
        )}
        <span className="text-[var(--color-muted)]">{buyExchangeInfo?.name}</span>
        <span className="text-[var(--color-fg)] tabular-nums">${formatPrice(buyPrice)}</span>
        <span className="text-[var(--color-muted)]">×</span>
        <span className="text-[var(--color-fg)] tabular-nums">{amount?.toFixed(6)} {crypto}</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5 ml-16 text-[11px]">
        <span className="text-rose-500">SELL</span>
        {sellExchangeInfo?.logo && (
          <img src={sellExchangeInfo.logo} alt={sellExchange} className="w-3.5 h-3.5 rounded" />
        )}
        <span className="text-[var(--color-muted)]">{sellExchangeInfo?.name}</span>
        <span className="text-[var(--color-fg)] tabular-nums">${formatPrice(sellPrice)}</span>
        <span className="text-[var(--color-muted)]">→</span>
        <span className="text-emerald-500 tabular-nums">${formatPrice(profit)}</span>
        <span className="text-[var(--color-muted)]">profit</span>
        {fees > 0 && (
          <>
            <span className="text-[var(--color-muted)]">(fees: ${formatPrice(fees)})</span>
          </>
        )}
      </div>
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
  const [isLive] = useState(true);

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

  // Poll prices directly from API for real-time updates (every 15 seconds)
  useEffect(() => {
    if (!portfolio) return;

    const exchanges = portfolio.metadata?.exchanges || [];
    const cryptos = portfolio.crypto_assets || [];

    if (exchanges.length === 0 || cryptos.length === 0) return;

    const fetchPrices = async () => {
      try {
        const response = await fetch(
          `/api/arbitrage/prices?cryptos=${cryptos.join(',')}&exchanges=${exchanges.join(',')}`
        );

        if (!response.ok) return;

        const data = await response.json();

        if (data.success && data.prices) {
          // Transform API response to match expected format
          const transformedPrices = {};
          for (const [crypto, priceInfo] of Object.entries(data.prices)) {
            const exchangePrices = {};
            for (const [exchange, exchangeData] of Object.entries(priceInfo.exchanges || {})) {
              if (exchangeData.price) {
                exchangePrices[exchange] = {
                  exchange,
                  price: exchangeData.price,
                  volume24h: exchangeData.volume24h,
                  bidAskSpread: exchangeData.bidAskSpread,
                  lastUpdated: exchangeData.lastUpdated,
                };
              }
            }
            transformedPrices[crypto] = {
              crypto,
              prices: exchangePrices,
              bestBuy: priceInfo.bestBuy,
              bestSell: priceInfo.bestSell,
              spreadPercent: priceInfo.spread?.percent,
              spreadUsd: priceInfo.spread?.usd,
              timestamp: data.timestamp,
            };
          }

          setPricesData(transformedPrices);
          setOpportunities(data.opportunities || []);
          setLastUpdated(new Date(data.timestamp));
        }
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    };

    // Fetch immediately
    fetchPrices();

    // Then poll every 15 seconds
    const interval = setInterval(fetchPrices, 15000);

    return () => clearInterval(interval);
  }, [portfolio]);

  // Fetch historical opportunities and subscribe to new ones
  useEffect(() => {
    if (!portfolioId) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('arbitrage_opportunities')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setTerminalLogs(data.map(row => ({
          id: row.id,
          timestamp: row.created_at,
          crypto: row.crypto,
          buyExchange: row.buy_exchange,
          sellExchange: row.sell_exchange,
          buyPrice: row.buy_price,
          sellPrice: row.sell_price,
          amount: row.amount,
          profit: row.profit,
          profitPercent: row.profit_percent,
          fees: row.fees,
          status: row.status,
        })));
      }
    };

    fetchHistory();

    // Subscribe to new opportunities
    const opportunitiesChannel = supabase
      .channel(`opportunities-${portfolioId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arbitrage_opportunities',
          filter: `portfolio_id=eq.${portfolioId}`,
        },
        (payload) => {
          const row = payload.new;
          setTerminalLogs(prev => [{
            id: row.id,
            timestamp: row.created_at,
            crypto: row.crypto,
            buyExchange: row.buy_exchange,
            sellExchange: row.sell_exchange,
            buyPrice: row.buy_price,
            sellPrice: row.sell_price,
            amount: row.amount,
            profit: row.profit,
            profitPercent: row.profit_percent,
            fees: row.fees,
            status: row.status,
          }, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(opportunitiesChannel);
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

          const exchangePrices = Object.entries(cryptoData.prices || {})
            .map(([key, data]) => ({ key, ...data }))
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
                      <span className={`text-sm tabular-nums ${
                        isLowest ? 'text-emerald-500' : isHighest ? 'text-rose-500' : 'text-[var(--color-fg)]'
                      }`}>
                        ${formatPrice(exchangeData.price)}
                      </span>
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

      {/* Arbitrage Opportunities Terminal - Theme Aware */}
      <Card variant="glass" padding="none" className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]/20 flex items-center gap-2">
          <LuTerminal className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-fg)]">Opportunity Feed</span>
          <span className="text-xs text-[var(--color-muted)]">— detected arbitrage opportunities</span>
        </div>
        <div
          ref={terminalRef}
          className="p-4 bg-[var(--color-surface)] h-64 overflow-y-auto"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          {terminalLogs.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] font-mono flex items-center gap-2">
              <span className="animate-pulse">●</span>
              <span>Scanning exchanges for arbitrage opportunities...</span>
            </div>
          ) : (
            <div>
              {terminalLogs.map((log) => (
                <OpportunityEntry key={log.id} {...log} />
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
