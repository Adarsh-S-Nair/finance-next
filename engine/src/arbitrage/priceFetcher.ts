/**
 * Multi-Exchange Price Fetcher for Arbitrage
 * Fetches crypto prices from CoinGecko for multiple exchanges
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Supported exchanges with their CoinGecko IDs
const EXCHANGES: Record<string, { id: string; name: string }> = {
  binance: { id: 'binance', name: 'Binance' },
  coinbase: { id: 'gdax', name: 'Coinbase' },
  kraken: { id: 'kraken', name: 'Kraken' },
  kucoin: { id: 'kucoin', name: 'KuCoin' },
  bybit: { id: 'bybit_spot', name: 'Bybit' },
  okx: { id: 'okex', name: 'OKX' },
};

// Supported cryptocurrencies with their CoinGecko IDs
const CRYPTOCURRENCIES: Record<string, { id: string; name: string }> = {
  BTC: { id: 'bitcoin', name: 'Bitcoin' },
  ETH: { id: 'ethereum', name: 'Ethereum' },
  SOL: { id: 'solana', name: 'Solana' },
  XRP: { id: 'ripple', name: 'XRP' },
  DOGE: { id: 'dogecoin', name: 'Dogecoin' },
  ADA: { id: 'cardano', name: 'Cardano' },
  AVAX: { id: 'avalanche-2', name: 'Avalanche' },
  LINK: { id: 'chainlink', name: 'Chainlink' },
};

export interface ExchangePrice {
  exchange: string;
  price: number;
  volume24h: number;
  bidAskSpread: number;
  lastUpdated: string;
}

export interface ArbitragePrice {
  crypto: string;
  prices: Record<string, ExchangePrice>;
  bestBuy: { exchange: string; price: number } | null;
  bestSell: { exchange: string; price: number } | null;
  spreadPercent: number | null;
  spreadUsd: number | null;
  timestamp: string;
}

export interface ArbitrageOpportunity {
  portfolioId: string;
  crypto: string;
  buyExchange: string;
  buyPrice: number;
  sellExchange: string;
  sellPrice: number;
  spreadPercent: number;
  spreadUsd: number;
  timestamp: string;
}

export interface DetectedOpportunity {
  portfolioId: string;
  crypto: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  amount: number;
  grossProfit: number;
  fees: number;
  profit: number;
  profitPercent: number;
  status: 'detected' | 'executed' | 'missed' | 'expired';
  metadata?: {
    buyVolume24h?: number;
    sellVolume24h?: number;
    buyBidAskSpread?: number;
    sellBidAskSpread?: number;
    capitalUsed?: number;
  };
}

// Fee structure per exchange (maker/taker fees as decimal)
const EXCHANGE_FEES: Record<string, { maker: number; taker: number }> = {
  binance: { maker: 0.001, taker: 0.001 },   // 0.1%
  coinbase: { maker: 0.004, taker: 0.006 },  // 0.4%/0.6%
  kraken: { maker: 0.0016, taker: 0.0026 },  // 0.16%/0.26%
  kucoin: { maker: 0.001, taker: 0.001 },    // 0.1%
  bybit: { maker: 0.001, taker: 0.001 },     // 0.1%
  okx: { maker: 0.0008, taker: 0.001 },      // 0.08%/0.1%
};

// Minimum profit threshold after fees (as percentage)
const MIN_PROFIT_THRESHOLD = 0.1; // 0.1% minimum net profit to log an opportunity

// Maximum capital to use per trade (as percentage of exchange balance)
const MAX_TRADE_CAPITAL_PCT = 0.5; // Use at most 50% of exchange balance per trade

export class ArbitragePriceFetcher {
  private supabase: SupabaseClient;
  private fetchInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Start periodic price fetching for all active arbitrage portfolios
   */
  async start(intervalMs: number = 30000): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.log('Starting arbitrage price fetcher...');

    // Initial fetch
    await this.fetchAndStorePrices();

    // Set up interval
    this.fetchInterval = setInterval(async () => {
      await this.fetchAndStorePrices();
    }, intervalMs);

    this.log(`Arbitrage price fetcher started (interval: ${intervalMs / 1000}s)`);
  }

  /**
   * Stop the price fetcher
   */
  stop(): void {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }
    this.isRunning = false;
    this.log('Arbitrage price fetcher stopped');
  }

  /**
   * Fetch prices and store them for all active arbitrage portfolios
   */
  private async fetchAndStorePrices(): Promise<void> {
    try {
      // Get all active arbitrage portfolios
      const { data: portfolios, error: fetchError } = await this.supabase
        .from('portfolios')
        .select('id, crypto_assets, metadata')
        .eq('type', 'arbitrage_simulation')
        .eq('status', 'active');

      if (fetchError) {
        this.log(`Error fetching portfolios: ${fetchError.message}`);
        return;
      }

      if (!portfolios || portfolios.length === 0) {
        return; // No active arbitrage portfolios
      }

      // Collect all unique cryptos and exchanges needed
      const allCryptos = new Set<string>();
      const allExchanges = new Set<string>();

      for (const portfolio of portfolios) {
        const cryptos = portfolio.crypto_assets || [];
        const exchanges = portfolio.metadata?.exchanges || [];

        cryptos.forEach((c: string) => allCryptos.add(c.toUpperCase()));
        exchanges.forEach((e: string) => allExchanges.add(e.toLowerCase()));
      }

      if (allCryptos.size === 0 || allExchanges.size === 0) {
        return;
      }

      // Fetch prices for all needed cryptos/exchanges
      const prices = await this.fetchPricesFromCoinGecko(
        Array.from(allCryptos),
        Array.from(allExchanges)
      );

      // Store prices and detect opportunities for each portfolio
      for (const portfolio of portfolios) {
        const portfolioCryptos = (portfolio.crypto_assets || []).map((c: string) => c.toUpperCase());
        const portfolioExchanges = (portfolio.metadata?.exchanges || []).map((e: string) => e.toLowerCase());

        // Filter prices for this portfolio
        const portfolioPrices: Record<string, ArbitragePrice> = {};
        const opportunities: ArbitrageOpportunity[] = [];

        for (const crypto of portfolioCryptos) {
          if (prices[crypto]) {
            const cryptoPrices = prices[crypto];

            // Filter to only portfolio's exchanges
            const filteredPrices: Record<string, ExchangePrice> = {};
            for (const exchange of portfolioExchanges) {
              if (cryptoPrices.prices[exchange]) {
                filteredPrices[exchange] = cryptoPrices.prices[exchange];
              }
            }

            // Recalculate best buy/sell for this portfolio's exchanges
            let lowestPrice = Infinity;
            let highestPrice = 0;
            let lowestExchange: string | null = null;
            let highestExchange: string | null = null;

            for (const [exchange, data] of Object.entries(filteredPrices)) {
              if (data.price) {
                if (data.price < lowestPrice) {
                  lowestPrice = data.price;
                  lowestExchange = exchange;
                }
                if (data.price > highestPrice) {
                  highestPrice = data.price;
                  highestExchange = exchange;
                }
              }
            }

            const spreadPercent = lowestPrice < Infinity && highestPrice > 0
              ? ((highestPrice - lowestPrice) / lowestPrice) * 100
              : null;
            const spreadUsd = lowestPrice < Infinity && highestPrice > 0
              ? highestPrice - lowestPrice
              : null;

            portfolioPrices[crypto] = {
              crypto,
              prices: filteredPrices,
              bestBuy: lowestExchange ? { exchange: lowestExchange, price: lowestPrice } : null,
              bestSell: highestExchange ? { exchange: highestExchange, price: highestPrice } : null,
              spreadPercent,
              spreadUsd,
              timestamp: new Date().toISOString(),
            };

            // Check if this is a tradeable opportunity (spread > fees threshold)
            if (spreadPercent && spreadPercent > 0.3 && lowestExchange && highestExchange && lowestExchange !== highestExchange) {
              // Calculate realistic opportunity with fees
              const detectedOpp = this.calculateOpportunity(
                portfolio.id,
                crypto,
                lowestExchange,
                highestExchange,
                lowestPrice,
                highestPrice,
                filteredPrices[lowestExchange],
                filteredPrices[highestExchange],
                portfolio.metadata?.capitalPerExchange || 0
              );

              if (detectedOpp && detectedOpp.profitPercent >= MIN_PROFIT_THRESHOLD) {
                // Store opportunity for the terminal
                await this.storeOpportunity(detectedOpp);

                opportunities.push({
                  portfolioId: portfolio.id,
                  crypto,
                  buyExchange: lowestExchange,
                  buyPrice: lowestPrice,
                  sellExchange: highestExchange,
                  sellPrice: highestPrice,
                  spreadPercent: detectedOpp.profitPercent,
                  spreadUsd: detectedOpp.profit,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        }

        // Store the latest prices in portfolio metadata for UI access
        await this.updatePortfolioPrices(portfolio.id, portfolioPrices, opportunities);
      }
    } catch (error: any) {
      this.log(`Error in fetchAndStorePrices: ${error.message}`);
    }
  }

  /**
   * Calculate a realistic arbitrage opportunity with fees
   */
  private calculateOpportunity(
    portfolioId: string,
    crypto: string,
    buyExchange: string,
    sellExchange: string,
    buyPrice: number,
    sellPrice: number,
    buyExchangeData: ExchangePrice,
    sellExchangeData: ExchangePrice,
    capitalPerExchange: number
  ): DetectedOpportunity | null {
    try {
      // Get fee rates for each exchange (use taker fees for market orders)
      const buyFeeRate = EXCHANGE_FEES[buyExchange]?.taker || 0.001;
      const sellFeeRate = EXCHANGE_FEES[sellExchange]?.taker || 0.001;

      // Calculate available capital (use minimum of buy and sell exchange balances)
      // In real arbitrage, you need capital on both exchanges
      const availableCapital = Math.min(
        capitalPerExchange * MAX_TRADE_CAPITAL_PCT,
        10000 // Cap at $10k per trade for paper trading realism
      );

      if (availableCapital < 100) {
        return null; // Minimum $100 trade
      }

      // Calculate amount of crypto we can buy with available capital
      const buyFee = availableCapital * buyFeeRate;
      const effectiveBuyCapital = availableCapital - buyFee;
      const cryptoAmount = effectiveBuyCapital / buyPrice;

      // Calculate revenue from selling
      const grossRevenue = cryptoAmount * sellPrice;
      const sellFee = grossRevenue * sellFeeRate;
      const netRevenue = grossRevenue - sellFee;

      // Calculate profit
      const totalFees = buyFee + sellFee;
      const grossProfit = grossRevenue - availableCapital;
      const netProfit = netRevenue - availableCapital;
      const profitPercent = (netProfit / availableCapital) * 100;

      // Only return if profitable after fees
      if (netProfit <= 0) {
        return null;
      }

      return {
        portfolioId,
        crypto,
        buyExchange,
        sellExchange,
        buyPrice,
        sellPrice,
        amount: cryptoAmount,
        grossProfit,
        fees: totalFees,
        profit: netProfit,
        profitPercent,
        status: 'detected',
        metadata: {
          buyVolume24h: buyExchangeData.volume24h,
          sellVolume24h: sellExchangeData.volume24h,
          buyBidAskSpread: buyExchangeData.bidAskSpread,
          sellBidAskSpread: sellExchangeData.bidAskSpread,
          capitalUsed: availableCapital,
        },
      };
    } catch (error: any) {
      this.log(`Error calculating opportunity: ${error.message}`);
      return null;
    }
  }

  /**
   * Store a detected opportunity to the database
   */
  private async storeOpportunity(opportunity: DetectedOpportunity): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('arbitrage_opportunities')
        .insert({
          portfolio_id: opportunity.portfolioId,
          crypto: opportunity.crypto,
          buy_exchange: opportunity.buyExchange,
          sell_exchange: opportunity.sellExchange,
          buy_price: opportunity.buyPrice,
          sell_price: opportunity.sellPrice,
          amount: opportunity.amount,
          gross_profit: opportunity.grossProfit,
          fees: opportunity.fees,
          profit: opportunity.profit,
          profit_percent: opportunity.profitPercent,
          status: opportunity.status,
          metadata: opportunity.metadata,
        });

      if (error) {
        this.log(`Error storing opportunity: ${error.message}`);
      } else {
        this.log(`📈 Opportunity detected: ${opportunity.crypto} | Buy ${opportunity.buyExchange} @ $${opportunity.buyPrice.toFixed(2)} → Sell ${opportunity.sellExchange} @ $${opportunity.sellPrice.toFixed(2)} | Profit: $${opportunity.profit.toFixed(2)} (${opportunity.profitPercent.toFixed(3)}%)`);
      }
    } catch (error: any) {
      this.log(`Error in storeOpportunity: ${error.message}`);
    }
  }

  /**
   * Fetch prices from CoinGecko API
   */
  private async fetchPricesFromCoinGecko(
    cryptos: string[],
    exchanges: string[]
  ): Promise<Record<string, ArbitragePrice>> {
    const result: Record<string, ArbitragePrice> = {};

    for (const symbol of cryptos) {
      const crypto = CRYPTOCURRENCIES[symbol];
      if (!crypto) continue;

      try {
        const exchangeIds = exchanges
          .map(e => EXCHANGES[e]?.id)
          .filter(Boolean)
          .join(',');

        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto.id}/tickers?exchange_ids=${exchangeIds}&include_exchange_logo=true`,
          {
            headers: { 'Accept': 'application/json' },
          }
        );

        if (!response.ok) {
          this.log(`CoinGecko API error for ${symbol}: ${response.status}`);
          continue;
        }

        const data: any = await response.json();
        const prices: Record<string, ExchangePrice> = {};

        let lowestPrice = Infinity;
        let highestPrice = 0;
        let lowestExchange: string | null = null;
        let highestExchange: string | null = null;

        for (const exchangeKey of exchanges) {
          const exchange = EXCHANGES[exchangeKey];
          if (!exchange) continue;

          // Find tickers for this exchange (USD/USDT pairs)
          const exchangeTickers = data.tickers?.filter((t: any) =>
            t.market?.identifier === exchange.id &&
            (t.target === 'USD' || t.target === 'USDT' || t.target === 'BUSD')
          ) || [];

          if (exchangeTickers.length > 0) {
            // Get the most liquid ticker
            const bestTicker = exchangeTickers.reduce((best: any, current: any) => {
              const currentVolume = current.converted_volume?.usd || 0;
              const bestVolume = best.converted_volume?.usd || 0;
              return currentVolume > bestVolume ? current : best;
            }, exchangeTickers[0]);

            const price = bestTicker.converted_last?.usd || bestTicker.last;
            const volume24h = bestTicker.converted_volume?.usd || 0;
            const bidAskSpread = bestTicker.bid_ask_spread_percentage || 0;

            prices[exchangeKey] = {
              exchange: exchangeKey,
              price,
              volume24h,
              bidAskSpread,
              lastUpdated: bestTicker.last_traded_at || new Date().toISOString(),
            };

            if (price < lowestPrice) {
              lowestPrice = price;
              lowestExchange = exchangeKey;
            }
            if (price > highestPrice) {
              highestPrice = price;
              highestExchange = exchangeKey;
            }
          }
        }

        const spreadPercent = lowestPrice < Infinity && highestPrice > 0
          ? ((highestPrice - lowestPrice) / lowestPrice) * 100
          : null;
        const spreadUsd = lowestPrice < Infinity && highestPrice > 0
          ? highestPrice - lowestPrice
          : null;

        result[symbol] = {
          crypto: symbol,
          prices,
          bestBuy: lowestExchange ? { exchange: lowestExchange, price: lowestPrice } : null,
          bestSell: highestExchange ? { exchange: highestExchange, price: highestPrice } : null,
          spreadPercent,
          spreadUsd,
          timestamp: new Date().toISOString(),
        };

        // Rate limit: small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        this.log(`Error fetching ${symbol} prices: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Update portfolio with latest prices
   */
  private async updatePortfolioPrices(
    portfolioId: string,
    prices: Record<string, ArbitragePrice>,
    opportunities: ArbitrageOpportunity[]
  ): Promise<void> {
    try {
      // Get current metadata
      const { data: portfolio, error: fetchError } = await this.supabase
        .from('portfolios')
        .select('metadata')
        .eq('id', portfolioId)
        .single();

      if (fetchError) {
        this.log(`Error fetching portfolio ${portfolioId}: ${fetchError.message}`);
        return;
      }

      // Update metadata with latest prices
      const updatedMetadata = {
        ...(portfolio?.metadata || {}),
        latestPrices: prices,
        latestOpportunities: opportunities,
        lastPriceUpdate: new Date().toISOString(),
      };

      const { error: updateError } = await this.supabase
        .from('portfolios')
        .update({ metadata: updatedMetadata })
        .eq('id', portfolioId);

      if (updateError) {
        this.log(`Error updating portfolio ${portfolioId}: ${updateError.message}`);
      }
    } catch (error: any) {
      this.log(`Error in updatePortfolioPrices: ${error.message}`);
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ArbitrageFetcher] ${message}`);
  }
}
