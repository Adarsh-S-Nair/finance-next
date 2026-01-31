"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "../../../../components/ui/Card";
import Button from "../../../../components/ui/Button";
import LineChart from "../../../../components/ui/LineChart";
import { supabase } from "../../../../lib/supabaseClient";
import { BacktestTradingEngine } from "../../../../lib/backtestTradingEngine";

// Available cryptos with chain info for Trust Wallet logos
const AVAILABLE_CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin', chain: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum' },
];

// ===== SIMULATION CONFIGURATION =====
// Adjust this value to control simulation replay speed
// Lower = faster, Higher = slower
// Examples: 100 = very fast, 500 = fast, 1000 = normal, 2000 = slow
const SIMULATION_SPEED_MS = 10; // milliseconds between each 5m candle

// Get Trust Wallet logo URL for a crypto
const getTrustWalletLogoUrl = (chain) => {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;
};

// Logo display component with error handling
function LogoDisplay({ logo, ticker }) {
  const [imageError, setImageError] = useState(false);

  if (!logo || imageError) {
    return (
      <div
        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
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
      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      style={{ border: '1px solid var(--color-border)' }}
      onError={() => setImageError(true)}
    />
  );
}

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

function BacktestResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [backtestData, setBacktestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cryptoPrices, setCryptoPrices] = useState({});
  const [startingPrices, setStartingPrices] = useState({}); // Track starting prices for change calculation
  const [cryptoTickers, setCryptoTickers] = useState({}); // Store ticker data (logo, name)
  const [currentCandle, setCurrentCandle] = useState(null);
  const [currentSimulationTime, setCurrentSimulationTime] = useState(null);
  const [tradingEngine, setTradingEngine] = useState(null);
  const [simulatedTrades, setSimulatedTrades] = useState([]);
  const [simulatedHoldings, setSimulatedHoldings] = useState([]);
  const [portfolioValue, setPortfolioValue] = useState(null);
  const [indicators, setIndicators] = useState({}); // Store latest indicator values

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const parsed = JSON.parse(dataParam);
        console.log('📋 Parsed backtest data:', {
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          cryptoAssets: parsed.cryptoAssets,
        });
        setBacktestData(parsed);
      } catch (error) {
        console.error('Error parsing backtest data:', error);
      }
    }
    setLoading(false);
  }, [searchParams]);

  // Extract cryptoAssets, startDate, and endDate from backtestData for the useEffect dependency
  const cryptoAssets = backtestData?.cryptoAssets;
  const startDate = backtestData?.startDate;
  const endDate = backtestData?.endDate;

  // Fetch crypto ticker data (logos, names) from database
  useEffect(() => {
    if (!cryptoAssets || cryptoAssets.length === 0) {
      return;
    }

    const fetchCryptoTickers = async () => {
      try {
        const cryptoSymbols = cryptoAssets.map(s => s.toUpperCase());

        // Fetch existing crypto tickers
        const { data: existingTickers, error: fetchError } = await supabase
          .from('tickers')
          .select('symbol, name, logo, asset_type')
          .in('symbol', cryptoSymbols)
          .eq('asset_type', 'crypto');

        if (fetchError) {
          console.error('Error fetching crypto tickers:', fetchError);
        }

        // Create a map of symbol -> ticker data (using uppercase keys like portfolio creation UI)
        const tickerMap = {};
        if (existingTickers) {
          existingTickers.forEach(ticker => {
            tickerMap[ticker.symbol] = ticker;
          });
        }

        // Fill in any missing data with defaults and Trust Wallet URLs
        cryptoAssets.forEach(symbol => {
          const symbolUpper = symbol.toUpperCase();
          const cryptoInfo = AVAILABLE_CRYPTOS.find(c => c.symbol === symbolUpper);

          if (!tickerMap[symbolUpper]) {
            // Ticker doesn't exist - use defaults
            tickerMap[symbolUpper] = {
              symbol: symbolUpper,
              name: cryptoInfo?.name || symbolUpper,
              logo: cryptoInfo ? getTrustWalletLogoUrl(cryptoInfo.chain) : null,
            };
          } else {
            // Ticker exists - ensure we have name and logo
            if (!tickerMap[symbolUpper].name) {
              tickerMap[symbolUpper].name = cryptoInfo?.name || symbolUpper;
            }
            if (!tickerMap[symbolUpper].logo && cryptoInfo) {
              tickerMap[symbolUpper].logo = getTrustWalletLogoUrl(cryptoInfo.chain);
            }
          }
        });

        setCryptoTickers(tickerMap);
        console.log(`✅ [BACKTEST] Loaded ticker data for ${Object.keys(tickerMap).length} crypto asset(s)`);
      } catch (error) {
        console.error('Error fetching crypto tickers:', error);
        // Fallback: use Trust Wallet URLs directly
        const fallbackMap = {};
        cryptoAssets.forEach(symbol => {
          const symbolUpper = symbol.toUpperCase();
          const cryptoInfo = AVAILABLE_CRYPTOS.find(c => c.symbol === symbolUpper);
          if (cryptoInfo) {
            fallbackMap[symbolUpper] = {
              symbol: symbolUpper,
              name: cryptoInfo.name,
              logo: getTrustWalletLogoUrl(cryptoInfo.chain),
            };
          }
        });
        setCryptoTickers(fallbackMap);
      }
    };

    fetchCryptoTickers();
  }, [cryptoAssets]);

  // Fetch crypto prices for the start date
  useEffect(() => {
    if (!cryptoAssets || cryptoAssets.length === 0 || !startDate) return;

    const fetchCryptoPrices = async () => {
      try {
        // Convert symbols to product IDs (BTC -> BTC-USD)
        const products = cryptoAssets.map(symbol => `${symbol.toUpperCase()}-USD`).join(',');

        // Get start date and end date (same day, just need one candle)
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        const endDateTime = new Date(startDate);
        endDateTime.setHours(23, 59, 59, 999);

        const response = await fetch(
          `/api/market-data/crypto-candles?products=${products}&timeframe=1d&startTime=${startDateTime.toISOString()}&endTime=${endDateTime.toISOString()}`
        );

        if (response.ok) {
          const data = await response.json();
          const prices = {};

          // The API returns candles grouped by product_id as an object
          if (data.candles && typeof data.candles === 'object') {
            cryptoAssets.forEach(symbol => {
              const productId = `${symbol.toUpperCase()}-USD`;
              const productCandles = data.candles[productId];

              if (productCandles && Array.isArray(productCandles) && productCandles.length > 0) {
                // Get the first candle (they're ordered by time ascending)
                const candle = productCandles[0];
                // Store with lowercase key to match candle updates
                prices[symbol.toLowerCase()] = candle.close;
              }
            });
          }

          setCryptoPrices(prices);
          // Store starting prices for change calculation
          setStartingPrices(prices);

          // Initialize simulation time to start date
          if (startDate) {
            const startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
            setCurrentSimulationTime(startDateTime);
          }
        }
      } catch (error) {
        console.error('Error fetching crypto prices:', error);
      }
    };

    fetchCryptoPrices();
  }, [cryptoAssets, startDate]);

  // Fetch and replay historical 5-minute candles from backtest start date
  useEffect(() => {
    if (!cryptoAssets || cryptoAssets.length === 0 || !startDate) return;

    let isCancelled = false;
    let replayTimeout = null;

    const fetchAndReplayCandles = async () => {
      try {
        // Convert symbols to product IDs (BTC -> BTC-USD)
        const products = cryptoAssets.map(symbol => `${symbol.toUpperCase()}-USD`);

        // Parse dates correctly (handle YYYY-MM-DD format)
        const startDateObj = new Date(startDate + 'T00:00:00.000Z');
        const endDateObj = new Date((endDate || startDate) + 'T23:59:59.999Z');

        // Ensure we're using UTC to avoid timezone issues
        const startDateTime = new Date(Date.UTC(
          startDateObj.getUTCFullYear(),
          startDateObj.getUTCMonth(),
          startDateObj.getUTCDate(),
          0, 0, 0, 0
        ));
        const endDateTime = new Date(Date.UTC(
          endDateObj.getUTCFullYear(),
          endDateObj.getUTCMonth(),
          endDateObj.getUTCDate(),
          23, 59, 59, 999
        ));


        // Fetch 5m candles first (primary data for simulation)
        console.log('📊 [BACKTEST] Fetching 5m candles...');
        const response5m = await fetch(`/api/market-data/crypto-candles-historical?products=${products.join(',')}&timeframe=5m&startTime=${startDateTime.toISOString()}&endTime=${endDateTime.toISOString()}`);

        if (!response5m.ok) {
          const errorText = await response5m.text();
          console.error('Failed to fetch 5m candles:', response5m.status, errorText);
          return;
        }

        const data5m = await response5m.json();
        console.log(`📊 [BACKTEST] 5m candles received:`, Object.keys(data5m.candles || {}).map(k => `${k}: ${data5m.candles[k]?.length || 0}`).join(', '));

        // Fetch 1h candles starting 10 days BEFORE backtest start for EMA warmup
        // EMA200 on 1h candles needs ~200 hours = 8+ days of prior data
        const warmupStartDateTime = new Date(startDateTime.getTime() - (10 * 24 * 60 * 60 * 1000));
        console.log('📊 [BACKTEST] Fetching 1h candles (with 10-day warmup)...');
        const response1h = await fetch(`/api/market-data/crypto-candles-historical?products=${products.join(',')}&timeframe=1h&startTime=${warmupStartDateTime.toISOString()}&endTime=${endDateTime.toISOString()}`);

        let data1h = { candles: {} };
        if (!response1h.ok) {
          const errorText = await response1h.text();
          console.error('Failed to fetch 1h candles:', response1h.status, errorText);
        } else {
          data1h = await response1h.json();
        }

        console.log(`📊 [BACKTEST] 1h candles received:`, Object.keys(data1h.candles || {}).map(k => `${k}: ${data1h.candles[k]?.length || 0}`).join(', '));

        // Log the date range of 1h candles
        Object.keys(data1h.candles || {}).forEach(productId => {
          const candles = data1h.candles[productId] || [];
          if (candles.length > 0) {
            console.log(`📊 [BACKTEST] ${productId} 1h range: ${candles[0]?.time} to ${candles[candles.length - 1]?.time}`);
          }
        });

        const data = data5m;


        if (!data.candles || typeof data.candles !== 'object') {
          console.error('Invalid candles data format:', data);
          return;
        }

        // Initialize trading engine
        const startingCapital = backtestData?.startingCapital || 100000;
        const engine = new BacktestTradingEngine(startingCapital);
        setTradingEngine(engine);

        // Pre-load 1h candles into engine
        let loaded1hCount = 0;
        products.forEach(productId => {
          const product1hCandles = data1h.candles[productId] || [];
          console.log(`📊 [BACKTEST] Loading ${product1hCandles.length} 1h candles for ${productId}`);

          // Load ALL 1h candles (don't filter by date range - the engine needs them for lookups)
          product1hCandles.forEach(candle => {
            const candleTime = new Date(candle.time);
            engine.addCandle({
              ...candle,
              productId,
              timestamp: candleTime,
            }, '1h');
            loaded1hCount++;
          });
        });
        console.log(`📊 [BACKTEST] Loaded ${loaded1hCount} total 1h candles into engine`);

        // Store engine reference for use in replay function
        let engineRef = engine;

        // Collect all candles from all products and group by timestamp
        const candlesByTimestamp = new Map();
        products.forEach(productId => {
          const productCandles = data.candles[productId] || [];
          productCandles.forEach(candle => {
            const candleTime = new Date(candle.time);
            // Filter candles to only include those within our date range
            if (candleTime >= startDateTime && candleTime <= endDateTime) {
              const timestampKey = candleTime.getTime();
              if (!candlesByTimestamp.has(timestampKey)) {
                candlesByTimestamp.set(timestampKey, []);
              }
              candlesByTimestamp.get(timestampKey).push({
                ...candle,
                productId,
                timestamp: candleTime,
              });
            }
          });
        });

        // Convert to array of timestamp groups, sorted by timestamp
        const timestampGroups = Array.from(candlesByTimestamp.entries())
          .map(([timestamp, candles]) => ({
            timestamp: new Date(timestamp),
            candles: candles.sort((a, b) => a.productId.localeCompare(b.productId)), // Sort candles within group by productId
          }))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        const totalCandles = timestampGroups.reduce((sum, group) => sum + group.candles.length, 0);

        // Log summary only (not every timestamp)
        if (timestampGroups.length > 0) {
          const firstGroup = timestampGroups[0];
          const lastGroup = timestampGroups[timestampGroups.length - 1];
          console.log(`📊 [BACKTEST] Loaded ${totalCandles} candles across ${timestampGroups.length} timestamps`);
          console.log(`   Range: ${firstGroup.timestamp.toISOString()} to ${lastGroup.timestamp.toISOString()}`);
        } else {
          console.warn(`⚠️ [BACKTEST] No candles found for date range`);
        }

        if (timestampGroups.length === 0) {
          console.warn('⚠️ [BACKTEST] No historical candles found for the backtest period');
          // Initialize simulation time to start date if no candles
          setCurrentSimulationTime(startDateTime);
          return;
        }

        // Initialize simulation time to start date
        setCurrentSimulationTime(startDateTime);
        console.log(`🚀 [BACKTEST] Starting simulation with ${products.length} product(s)`);

        // Replay candles grouped by timestamp - all products update simultaneously
        let currentIndex = 0;

        const replayNextTimestamp = () => {
          if (isCancelled || currentIndex >= timestampGroups.length) {
            console.log('✅ [BACKTEST] Simulation complete');
            return;
          }

          const timestampGroup = timestampGroups[currentIndex];

          // Update prices for all products at this timestamp simultaneously
          const priceUpdates = {};
          const pricesForEngine = {}; // Prices in format expected by engine (productId -> price)
          timestampGroup.candles.forEach(candle => {
            const symbol = candle.productId.replace('-USD', '').toLowerCase();
            priceUpdates[symbol] = candle.close;
            pricesForEngine[candle.productId] = candle.close;
          });

          // Process candles through trading engine
          if (engineRef) {
            // Feed 5m candles to engine and check for entry signals
            timestampGroup.candles.forEach(candle => {
              engineRef.process5mCandle(candle, timestampGroup.timestamp).catch((err) => {
                console.error('Error processing candle:', err);
              });
            });

            // Check for exits (stop loss / take profit)
            engineRef.checkExits(timestampGroup.timestamp, pricesForEngine);

            // Update state with trades, holdings, and indicators
            setSimulatedTrades([...engineRef.getTrades()]);
            setSimulatedHoldings([...engineRef.getHoldings(pricesForEngine)]);
            setPortfolioValue(engineRef.getEquity(pricesForEngine));
            setIndicators({ ...engineRef.getIndicators() });
          }

          setCryptoPrices(prev => {
            const updated = {
              ...prev,
              ...priceUpdates
            };

            // Set starting prices on first update if not already set
            setStartingPrices(prevStart => {
              const updatedStart = { ...prevStart };
              Object.keys(priceUpdates).forEach(symbol => {
                if (!(symbol in updatedStart) || updatedStart[symbol] === undefined) {
                  updatedStart[symbol] = priceUpdates[symbol];
                }
              });
              return updatedStart;
            });

            return updated;
          });

          // Update simulation time (use the timestamp from the group)
          setCurrentSimulationTime(timestampGroup.timestamp);

          currentIndex++;

          // Schedule next timestamp group
          replayTimeout = setTimeout(replayNextTimestamp, SIMULATION_SPEED_MS);
        };

        // Start replaying
        replayNextTimestamp();

      } catch (error) {
        console.error('Error fetching/replaying candles:', error);
      }
    };

    fetchAndReplayCandles();

    // Cleanup on unmount
    return () => {
      isCancelled = true;
      if (replayTimeout) {
        clearTimeout(replayTimeout);
      }
    };
  }, [cryptoAssets, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-muted)]">Loading backtest results...</div>
      </div>
    );
  }

  if (!backtestData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-[var(--color-muted)]">No backtest data found</div>
        <Button onClick={() => router.push('/paper-trading')}>Go Back</Button>
      </div>
    );
  }

  const { snapshots, startingCapital } = backtestData;

  // Use simulated trades and holdings from trading engine, or fallback to empty arrays
  const trades = simulatedTrades.length > 0 ? simulatedTrades : [];
  const holdings = simulatedHoldings.length > 0 ? simulatedHoldings : [];

  // Calculate final value and returns from simulated portfolio
  const currentValue = portfolioValue !== null ? portfolioValue : (startingCapital || 0);
  const finalValue = currentValue;
  const totalReturn = finalValue - (startingCapital || 0);
  const totalReturnPercent = startingCapital > 0 ? (totalReturn / startingCapital) * 100 : 0;

  // Prepare chart data
  const chartData = snapshots.map((snapshot) => ({
    date: new Date(snapshot.date),
    value: snapshot.value,
    dateString: snapshot.date,
  }));

  const totalReturnColor = totalReturn >= 0 ? 'text-emerald-500' : 'text-rose-500';

  // Determine the current date/time to display
  const displayDateTime = currentSimulationTime || (startDate ? new Date(startDate) : null);

  // Calculate statistics for the top cards
  const closedTrades = trades.filter(t => t.status === 'closed');
  const winningTrades = closedTrades.filter(t => parseFloat(t.realized_pnl || 0) > 0);
  const losingTrades = closedTrades.filter(t => parseFloat(t.realized_pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length * 100) : 0;
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + parseFloat(t.realized_pnl || 0), 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + parseFloat(t.realized_pnl || 0), 0) / losingTrades.length
    : 0;
  const totalPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.realized_pnl || 0), 0);
  const openTrades = trades.filter(t => t.status === 'open');

  return (
    <div className="space-y-6">
      {/* Stats Cards - Top Level */}
      {trades.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card variant="glass" padding="sm" className="bg-[var(--color-surface)]/40">
            <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-medium">Total Trades</div>
            <div className="text-xl text-[var(--color-fg)] tabular-nums mt-1 font-medium">
              {trades.length}
              {openTrades.length > 0 && (
                <span className="text-xs text-blue-500 ml-1.5 font-normal">({openTrades.length} open)</span>
              )}
            </div>
          </Card>
          <Card variant="glass" padding="sm" className="bg-[var(--color-surface)]/40">
            <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-medium">Win Rate</div>
            <div className={`text-xl tabular-nums mt-1 font-medium ${winRate >= 50 ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
              {winRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-[var(--color-muted)] mt-0.5">{winningTrades.length}W / {losingTrades.length}L</div>
          </Card>
          <Card variant="glass" padding="sm" className="bg-[var(--color-surface)]/40">
            <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-medium">Avg Win / Loss</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-sm text-emerald-500 tabular-nums font-medium">+${avgWin.toFixed(0)}</span>
              <span className="text-[var(--color-muted)]">/</span>
              <span className="text-sm text-[var(--color-fg)] tabular-nums font-normal">${Math.abs(avgLoss).toFixed(0)}</span>
            </div>
          </Card>
          <Card variant="glass" padding="sm" className="bg-[var(--color-surface)]/40">
            <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-medium">Total P&L</div>
            <div className={`text-xl tabular-nums mt-1 font-medium ${totalPnl >= 0 ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </div>
          </Card>
        </div>
      )}

      {/* Main Layout: Main Section + Side Column */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Section - 2/3 width */}
        <div className="lg:w-2/3 flex flex-col gap-6">



          {/* Portfolio Value Card */}
          <Card variant="glass" padding="none">
            <div className="mb-4 px-4 sm:px-6 pt-4 sm:pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider mb-1">
                    Portfolio Value
                  </div>
                  <div className="flex flex-col">
                    <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight tabular-nums">
                      {formatCurrency(finalValue)}
                    </div>
                    <div className={`text-xs font-medium mt-0.5 ${totalReturnColor}`}>
                      {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)} ({totalReturnPercent >= 0 ? '+' : ''}{totalReturnPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {displayDateTime && (
                    <div className="text-xs text-[var(--color-muted)] font-medium">
                      {displayDateTime.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      <span className="ml-2">
                        {displayDateTime.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="pt-4 pb-2 px-6">
                <div className="w-full" style={{ height: '240px' }}>
                  <LineChart
                    data={chartData}
                    dataKey="value"
                    width="100%"
                    height={240}
                    margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
                    strokeColor="var(--color-accent)"
                    strokeWidth={2}
                    showArea={true}
                    areaOpacity={0.15}
                    showDots={true}
                    dotRadius={3}
                    showTooltip={false}
                    gradientId="backtestGradient"
                    curveType="monotone"
                    animationDuration={800}
                    xAxisDataKey="dateString"
                    lines={[
                      {
                        dataKey: 'value',
                        strokeColor: 'var(--color-accent)',
                        strokeWidth: 2,
                        showArea: true,
                        areaOpacity: 0.15,
                        dotRadius: 3,
                      },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="mt-2 pt-2 px-6 pb-4 border-t border-[var(--color-border)]/50">
              <div className="flex justify-between items-center text-sm">
                <div>
                  <div className="text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">Starting Capital</div>
                  <div className="font-medium text-[var(--color-fg)] tabular-nums">
                    {formatCurrency(startingCapital)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--color-muted)] text-xs uppercase tracking-wider mb-1">Final Value</div>
                  <div className="font-medium text-[var(--color-fg)] tabular-nums">
                    {formatCurrency(finalValue)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Trades Table */}
          <Card variant="glass" padding="none">
            <div className="px-5 pt-5 pb-3">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
                Trades
              </div>
            </div>

            {trades && trades.length > 0 && (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="px-4 py-2 bg-[var(--color-surface)]/30 border-y border-[var(--color-border)]/30 grid grid-cols-6 gap-2 text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
                  <div>Symbol</div>
                  <div>Entry Date</div>
                  <div>Exit Date</div>
                  <div className="text-right">Entry Price</div>
                  <div className="text-right">Exit Price</div>
                  <div className="text-right">P&L</div>
                </div>

                {/* Table Body - Sorted by most recent first */}
                <div className="max-h-[400px] overflow-y-auto">
                  {[...trades]
                    .sort((a, b) => new Date(b.entry_date || 0).getTime() - new Date(a.entry_date || 0).getTime())
                    .map((trade, index) => {
                      const isClosed = trade.status === 'closed';
                      const realizedPnl = trade.realized_pnl ? parseFloat(trade.realized_pnl) : null;
                      const entryDate = trade.entry_date ? new Date(trade.entry_date) : null;
                      const exitDate = trade.exit_date ? new Date(trade.exit_date) : null;

                      return (
                        <div
                          key={`${trade.ticker}-${trade.entry_date}-${index}`}
                          className="px-4 py-3 grid grid-cols-6 gap-2 items-center border-b border-[var(--color-border)]/20 last:border-b-0 hover:bg-[var(--color-surface)]/30 transition-colors"
                        >
                          {/* Symbol */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--color-fg)]">{trade.ticker}</span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isClosed
                              ? 'bg-[var(--color-surface)] text-[var(--color-muted)]'
                              : 'bg-blue-500/20 text-blue-500'
                              }`}>
                              {isClosed ? 'CLOSED' : 'OPEN'}
                            </span>
                          </div>

                          {/* Entry Date */}
                          <div className="text-xs text-[var(--color-muted)] tabular-nums">
                            {entryDate ? entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            <span className="text-[var(--color-muted)]/50 ml-1">
                              {entryDate ? entryDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          {/* Exit Date */}
                          <div className="text-xs text-[var(--color-muted)] tabular-nums">
                            {exitDate ? exitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            {exitDate && (
                              <span className="text-[var(--color-muted)]/50 ml-1">
                                {exitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {/* Entry Price */}
                          <div className="text-right text-sm text-[var(--color-fg)] tabular-nums font-normal">
                            {formatCurrency(parseFloat(trade.entry_price))}
                          </div>

                          {/* Exit Price */}
                          <div className="text-right text-sm tabular-nums font-normal">
                            {isClosed && trade.exit_price ? (
                              <span className="text-[var(--color-fg)]">{formatCurrency(parseFloat(trade.exit_price))}</span>
                            ) : (
                              <span className="text-[var(--color-muted)]">—</span>
                            )}
                          </div>

                          {/* P&L */}
                          <div className="text-right">
                            {isClosed && realizedPnl !== null ? (
                              <span className={`text-sm font-medium tabular-nums ${realizedPnl >= 0 ? 'text-emerald-500' : 'text-[var(--color-fg)]'}`}>
                                {realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl)}
                              </span>
                            ) : (
                              <span className="text-sm text-[var(--color-muted)]">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}


            {(!trades || trades.length === 0) && (
              <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
                No trades executed during this period
              </div>
            )}
          </Card>
        </div>

        {/* Side Column - 1/3 width */}
        <div className="lg:w-1/3 flex flex-col gap-4">
          {/* Crypto Price Cards */}
          {cryptoAssets && cryptoAssets.length > 0 && (
            <div className="flex flex-col gap-3">
              {cryptoAssets.map((symbol) => {
                // Look up price by symbol (case-insensitive)
                const symbolUpper = symbol.toUpperCase();
                const symbolLower = symbol.toLowerCase();
                const price = cryptoPrices[symbolLower] || cryptoPrices[symbol];
                const startingPrice = startingPrices[symbolLower] || startingPrices[symbol];

                // Get ticker data using uppercase key (like portfolio creation UI)
                const tickerData = cryptoTickers[symbolUpper] || {
                  name: symbolUpper,
                  logo: null
                };

                // Calculate change from starting price
                let change = null;
                let changePercent = null;
                if (price !== undefined && price !== null && !isNaN(price) &&
                  startingPrice !== undefined && startingPrice !== null && !isNaN(startingPrice) && startingPrice > 0) {
                  change = price - startingPrice;
                  changePercent = (change / startingPrice) * 100;
                }

                const changeColor = change !== null && change !== undefined
                  ? (change >= 0 ? 'text-emerald-500' : 'text-rose-500')
                  : 'text-[var(--color-muted)]';

                return (
                  <Card key={symbol} variant="glass" padding="none">
                    <div className="px-5 pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        {/* Logo */}
                        <LogoDisplay logo={tickerData.logo} ticker={symbolUpper} />

                        {/* Price and Change */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
                              {tickerData.name || symbolUpper}
                            </div>
                          </div>
                          <div className="text-lg font-medium text-[var(--color-fg)] tabular-nums">
                            {price !== undefined && price !== null && !isNaN(price) ? formatCurrency(price) : '—'}
                          </div>
                          {change !== null && change !== undefined && (
                            <div className={`text-xs font-medium mt-0.5 ${changeColor}`}>
                              {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Holdings Table */}
          <Card variant="glass" padding="none">
            <div className="px-5 pt-5 pb-3">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
                Holdings
              </div>
            </div>
            {holdings && holdings.length > 0 ? (
              <div className="pb-3">
                {holdings.map((holding, index) => {
                  const pnl = parseFloat(holding.pnl);
                  const pnlPercent = parseFloat(holding.pnl_percent);
                  const pnlColor = pnl >= 0 ? 'text-emerald-500' : 'text-rose-500';

                  return (
                    <div
                      key={holding.ticker || index}
                      className="px-5 py-3 hover:bg-[var(--color-surface)]/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--color-fg)] truncate">
                            {holding.ticker}
                          </div>
                          <div className="text-xs text-[var(--color-muted)]">
                            {parseFloat(holding.quantity).toFixed(4)} @ {formatCurrency(parseFloat(holding.average_cost))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
                            {formatCurrency(parseFloat(holding.value))}
                          </div>
                          <div className={`text-xs font-medium tabular-nums ${pnlColor}`}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
                No holdings
              </div>
            )}
          </Card>

          {/* Strategy Indicators Dashboard */}
          <Card variant="glass" padding="none">
            <div className="px-5 pt-5 pb-3">
              <div className="text-xs text-[var(--color-muted)] font-medium uppercase tracking-wider">
                Strategy Indicators
              </div>
            </div>
            {Object.keys(indicators).length > 0 ? (
              <div className="pb-4">
                {Object.entries(indicators).map(([symbol, ind]) => (
                  <div key={symbol} className="px-5 py-3 border-b border-[var(--color-border)]/30 last:border-b-0">
                    {/* Symbol Header with Signal */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-fg)]">{symbol}</span>
                        <span className="text-xs text-[var(--color-muted)]">@ ${ind.price?.toFixed(2)}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${ind.signal === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : ind.signal === 'WAIT'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
                        }`}>
                        {ind.signal}
                      </span>
                    </div>

                    {/* Warmup State */}
                    {ind.warmingUp ? (
                      <div className="py-2 text-center">
                        <div className="text-xs text-amber-500 font-medium">
                          ⏳ {ind.warmupMessage}
                        </div>
                      </div>
                    ) : (
                      /* Indicator Grid */
                      <div className="space-y-2">
                        {/* No 1h Data Warning */}
                        {ind.no1hData && (
                          <div className="mb-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-center">
                            <span className="text-[10px] text-amber-500 font-medium">
                              ⚠️ 1h data unavailable for this date
                            </span>
                          </div>
                        )}

                        {/* Regime Filter (1h) */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${ind.no1hData ? 'bg-gray-400' : ind.regimePassing ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}></span>
                            <span className="text-xs text-[var(--color-muted)]">Trend (1h)</span>
                          </div>
                          <div className="text-right">
                            {ind.no1hData ? (
                              <span className="text-xs text-gray-400">N/A</span>
                            ) : (
                              <span className="text-xs font-medium text-[var(--color-fg)]">
                                {ind.close1h > ind.ema50_1h ? '↑ Above' : '↓ Below'} EMA50
                              </span>
                            )}
                          </div>
                        </div>

                        {/* EMA Slope */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${ind.no1hData ? 'bg-gray-400' : ind.emaSlope > 0 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}></span>
                            <span className="text-xs text-[var(--color-muted)]">EMA Slope</span>
                          </div>
                          <div className="text-right">
                            {ind.no1hData ? (
                              <span className="text-xs text-gray-400">N/A</span>
                            ) : (
                              <span className="text-xs font-medium text-[var(--color-fg)]">
                                {ind.emaSlope > 0 ? '📈' : '📉'} {ind.emaSlope?.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pullback */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${ind.pullbackPct <= ind.pullbackThreshold ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span className="text-xs text-[var(--color-muted)]">Pullback (5m)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-medium tabular-nums text-[var(--color-fg)]">
                              {ind.pullbackPct?.toFixed(2)}% / {ind.pullbackThreshold?.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* RSI */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${ind.rsi >= ind.rsiMin && ind.rsi <= ind.rsiMax ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span className="text-xs text-[var(--color-muted)]">RSI (5m)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-medium tabular-nums text-[var(--color-fg)]">
                              {ind.rsi?.toFixed(1)} ({ind.rsiMin}-{ind.rsiMax})
                            </span>
                          </div>
                        </div>

                        {/* Green Candle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${ind.isGreenCandle ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span className="text-xs text-[var(--color-muted)]">Candle</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-medium text-[var(--color-fg)]">
                              {ind.isGreenCandle ? '🟢 Bullish' : '🔴 Bearish'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reason */}
                    {ind.signalReason && !ind.warmingUp && (
                      <div className="mt-3 pt-2 border-t border-[var(--color-border)]/30">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]/60">
                          {ind.signalReason.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
                Warming up indicators...
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function BacktestResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-muted)]">Loading backtest results...</div>
      </div>
    }>
      <BacktestResultsContent />
    </Suspense>
  );
}

