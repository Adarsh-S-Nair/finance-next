"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "../../../../../components/ui/Card";
import Button from "../../../../../components/ui/Button";
import {
  LuRefreshCw,
  LuArrowRight,
  LuZap,
  LuTerminal,
} from "react-icons/lu";
import { useUser } from "../../../../../components/UserProvider";
import { supabase } from "../../../../../lib/supabaseClient";
import { usePaperTradingHeader } from "../../PaperTradingHeaderContext";
import { CardSkeleton } from "../../../../../components/ui/Skeleton";

// Exchange info
const EXCHANGE_INFO = {
  binance: { name: 'Binance', short: 'BIN' },
  coinbase: { name: 'Coinbase', short: 'CB' },
  kraken: { name: 'Kraken', short: 'KRK' },
  kucoin: { name: 'KuCoin', short: 'KUC' },
  bybit: { name: 'Bybit', short: 'BYB' },
  okx: { name: 'OKX', short: 'OKX' },
};

// Crypto info
const CRYPTO_INFO = {
  BTC: { name: 'Bitcoin' },
  ETH: { name: 'Ethereum' },
  SOL: { name: 'Solana' },
  XRP: { name: 'XRP' },
  DOGE: { name: 'Dogecoin' },
  ADA: { name: 'Cardano' },
  AVAX: { name: 'Avalanche' },
  LINK: { name: 'Chainlink' },
};

// Format price
const formatPrice = (amount, decimals = 2) => {
  if (amount === null || amount === undefined) return '—';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Format percentage
const formatPercent = (value) => {
  if (value === null || value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`;
};

// Terminal log entry
const TerminalEntry = ({ timestamp, crypto, exchange, price, type, spread }) => {
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const exchangeShort = EXCHANGE_INFO[exchange]?.short || exchange?.toUpperCase().slice(0, 3) || '???';

  if (type === 'opportunity') {
    return (
      <div className="font-mono text-xs leading-relaxed flex items-center gap-2">
        <span className="text-zinc-500">{timeStr}</span>
        <span className="text-blue-400">[{crypto}]</span>
        <span className="text-amber-400">OPPORTUNITY</span>
        <span className="text-zinc-400">{exchange}</span>
        <span className="text-emerald-400">Δ{formatPercent(spread)}</span>
        <span className="text-zinc-500">${formatPrice(price)}/unit</span>
      </div>
    );
  }

  return (
    <div className="font-mono text-xs leading-relaxed flex items-center gap-2">
      <span className="text-zinc-500">{timeStr}</span>
      <span className="text-blue-400">[{crypto}]</span>
      <span className="text-zinc-400">{exchangeShort}</span>
      <span className={type === 'low' ? 'text-emerald-400' : type === 'high' ? 'text-rose-400' : 'text-zinc-300'}>
        ${formatPrice(price)}
      </span>
      {type === 'low' && <span className="text-emerald-500/60 text-[10px]">LOW</span>}
      {type === 'high' && <span className="text-rose-500/60 text-[10px]">HIGH</span>}
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState([]);

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!portfolioId || !profile?.id) return;

      try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('*')
          .eq('id', portfolioId)
          .eq('user_id', profile.id)
          .single();

        if (error) throw error;
        setPortfolio(data);
      } catch (err) {
        console.error('Error fetching portfolio:', err);
        router.push('/paper-trading');
      }
    };

    fetchPortfolio();
  }, [portfolioId, profile?.id, router]);

  // Generate terminal logs from price data
  const generateTerminalLogs = useCallback((prices) => {
    const logs = [];
    const now = new Date();

    Object.entries(prices || {}).forEach(([crypto, cryptoData]) => {
      const exchanges = Object.entries(cryptoData.exchanges || {});

      // Find lowest and highest for this crypto
      let lowest = { price: Infinity, exchange: null };
      let highest = { price: 0, exchange: null };

      exchanges.forEach(([exchange, data]) => {
        if (data.price) {
          if (data.price < lowest.price) {
            lowest = { price: data.price, exchange };
          }
          if (data.price > highest.price) {
            highest = { price: data.price, exchange };
          }
        }
      });

      // Add log entries for each exchange price
      exchanges.forEach(([exchange, data]) => {
        if (data.price) {
          const type = data.price === lowest.price ? 'low' :
                       data.price === highest.price ? 'high' : 'normal';
          logs.push({
            id: `${crypto}-${exchange}-${now.getTime()}`,
            timestamp: now,
            crypto,
            exchange,
            price: data.price,
            type,
          });
        }
      });

      // Add spread opportunity log if significant
      if (cryptoData.spread?.percent > 0.3 && lowest.exchange && highest.exchange) {
        logs.push({
          id: `${crypto}-spread-${now.getTime()}`,
          timestamp: now,
          crypto,
          exchange: `${EXCHANGE_INFO[lowest.exchange]?.short}→${EXCHANGE_INFO[highest.exchange]?.short}`,
          price: cryptoData.spread.usd,
          type: 'opportunity',
          spread: cryptoData.spread.percent,
        });
      }
    });

    return logs;
  }, []);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    if (!portfolio?.crypto_assets || !portfolio?.metadata?.exchanges) return;

    setRefreshing(true);
    try {
      const cryptos = portfolio.crypto_assets.join(',');
      const exchanges = portfolio.metadata.exchanges.join(',');

      const response = await fetch(
        `/api/arbitrage/prices?cryptos=${cryptos}&exchanges=${exchanges}`
      );

      if (!response.ok) throw new Error('Failed to fetch prices');

      const data = await response.json();
      setPricesData(data.prices);
      setOpportunities(data.opportunities || []);
      setLastUpdated(new Date());

      // Generate and append terminal logs
      const newLogs = generateTerminalLogs(data.prices);
      setTerminalLogs(prev => [...newLogs, ...prev].slice(0, 100)); // Keep last 100 entries
    } catch (err) {
      console.error('Error fetching prices:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [portfolio, generateTerminalLogs]);

  // Initial fetch
  useEffect(() => {
    if (portfolio) {
      fetchPrices();
    }
  }, [portfolio, fetchPrices]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh || !portfolio) return;

    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, portfolio, fetchPrices]);

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
      {/* Compact Stats Row */}
      <div className="flex items-center gap-6 text-sm">
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
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            autoRefresh
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
          }`}
        >
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchPrices}
          disabled={refreshing}
          className="gap-1.5"
        >
          <LuRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
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
                  <span className="text-sm text-[var(--color-fg)]">{opp.crypto}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {EXCHANGE_INFO[opp.buyExchange]?.name} → {EXCHANGE_INFO[opp.sellExchange]?.name}
                  </span>
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

          if (!cryptoData) {
            return (
              <Card key={crypto} variant="glass" padding="none" className="p-4">
                <div className="text-[var(--color-muted)] text-sm">Loading {crypto}...</div>
              </Card>
            );
          }

          const exchangePrices = Object.entries(cryptoData.exchanges || {})
            .map(([key, data]) => ({ key, ...data }))
            .filter(e => e.price)
            .sort((a, b) => a.price - b.price);

          const lowestPrice = exchangePrices[0]?.price;
          const highestPrice = exchangePrices[exchangePrices.length - 1]?.price;
          const spread = cryptoData.spread;

          return (
            <Card key={crypto} variant="glass" padding="none" className="overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--color-border)]/20 flex items-center justify-between">
                <div>
                  <span className="text-sm text-[var(--color-fg)]">{crypto}</span>
                  <span className="text-xs text-[var(--color-muted)] ml-2">{CRYPTO_INFO[crypto]?.name}</span>
                </div>
                {spread && (
                  <span className={`text-sm tabular-nums ${spread.percent > 0.5 ? 'text-emerald-500' : 'text-[var(--color-muted)]'}`}>
                    {formatPercent(spread.percent)}
                  </span>
                )}
              </div>

              {/* Exchange Prices */}
              <div className="divide-y divide-[var(--color-border)]/10">
                {exchangePrices.map((exchangeData) => {
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
                        <span className="text-sm text-[var(--color-fg)]">
                          {EXCHANGE_INFO[exchangeData.key]?.name}
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
              {spread && spread.percent > 0.1 && cryptoData.bestBuy && cryptoData.bestSell && (
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

      {/* Terminal Feed */}
      <Card variant="glass" padding="none" className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]/20 flex items-center gap-2">
          <LuTerminal className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          <span className="text-sm text-[var(--color-fg)]">Price Feed</span>
          {lastUpdated && (
            <span className="text-xs text-[var(--color-muted)]">
              updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div
          ref={terminalRef}
          className="p-4 bg-zinc-950 h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800"
        >
          {terminalLogs.length === 0 ? (
            <div className="text-xs text-zinc-500 font-mono">
              $ waiting for price data...
            </div>
          ) : (
            <div className="space-y-0.5">
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
              <div className="text-xs text-[var(--color-muted)] mb-1">
                {exchange?.name}
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
