/**
 * Fetch live cryptocurrency prices from multiple exchanges
 * Uses CoinGecko API for exchange-specific pricing
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Supported exchanges with their CoinGecko IDs
const EXCHANGES = {
  binance: { id: 'binance', name: 'Binance', logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg' },
  coinbase: { id: 'gdax', name: 'Coinbase', logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png' },
  kraken: { id: 'kraken', name: 'Kraken', logo: 'https://assets.coingecko.com/markets/images/29/small/kraken.jpg' },
  kucoin: { id: 'kucoin', name: 'KuCoin', logo: 'https://assets.coingecko.com/markets/images/61/small/kucoin.png' },
  bybit: { id: 'bybit_spot', name: 'Bybit', logo: 'https://assets.coingecko.com/markets/images/698/small/bybit_spot.png' },
  okx: { id: 'okex', name: 'OKX', logo: 'https://assets.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png' },
};

// Supported cryptocurrencies with their CoinGecko IDs
const CRYPTOCURRENCIES = {
  BTC: { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  ETH: { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  SOL: { id: 'solana', name: 'Solana', symbol: 'SOL', logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  XRP: { id: 'ripple', name: 'XRP', symbol: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  DOGE: { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', logo: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
  ADA: { id: 'cardano', name: 'Cardano', symbol: 'ADA', logo: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  AVAX: { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX', logo: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },
  LINK: { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cryptosParam = searchParams.get('cryptos'); // comma-separated: BTC,ETH,SOL
    const exchangesParam = searchParams.get('exchanges'); // comma-separated: binance,coinbase,kraken

    // Parse parameters or use defaults
    const cryptoSymbols = cryptosParam
      ? cryptosParam.split(',').map(c => c.trim().toUpperCase())
      : ['BTC', 'ETH'];
    const exchangeIds = exchangesParam
      ? exchangesParam.split(',').map(e => e.trim().toLowerCase())
      : ['binance', 'coinbase', 'kraken'];

    // Validate inputs
    const validCryptos = cryptoSymbols.filter(c => CRYPTOCURRENCIES[c]);
    const validExchanges = exchangeIds.filter(e => EXCHANGES[e]);

    if (validCryptos.length === 0) {
      return NextResponse.json(
        { error: 'No valid cryptocurrencies specified' },
        { status: 400 }
      );
    }

    if (validExchanges.length === 0) {
      return NextResponse.json(
        { error: 'No valid exchanges specified' },
        { status: 400 }
      );
    }

    // Fetch prices for each crypto from CoinGecko
    const pricesData = {};
    const arbitrageOpportunities = [];

    for (const symbol of validCryptos) {
      const crypto = CRYPTOCURRENCIES[symbol];
      pricesData[symbol] = {
        crypto: crypto,
        exchanges: {},
        spread: null,
        bestBuy: null,
        bestSell: null,
      };

      try {
        // Fetch ticker data for this coin from CoinGecko
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${crypto.id}/tickers?exchange_ids=${validExchanges.map(e => EXCHANGES[e].id).join(',')}&include_exchange_logo=true`,
          {
            headers: {
              'Accept': 'application/json',
            },
            next: { revalidate: 10 }, // Cache for 10 seconds
          }
        );

        if (!response.ok) {
          console.error(`CoinGecko API error for ${symbol}:`, response.status);
          continue;
        }

        const data = await response.json();

        // Process tickers for each exchange
        let lowestPrice = Infinity;
        let highestPrice = 0;
        let lowestExchange = null;
        let highestExchange = null;

        for (const exchangeKey of validExchanges) {
          const exchange = EXCHANGES[exchangeKey];

          // Find tickers for this exchange (match by exchange ID and USD/USDT pairs)
          const exchangeTickers = data.tickers?.filter(t =>
            t.market?.identifier === exchange.id &&
            (t.target === 'USD' || t.target === 'USDT' || t.target === 'BUSD')
          ) || [];

          if (exchangeTickers.length > 0) {
            // Get the best (most liquid) ticker
            const bestTicker = exchangeTickers.reduce((best, current) => {
              const currentVolume = current.converted_volume?.usd || 0;
              const bestVolume = best.converted_volume?.usd || 0;
              return currentVolume > bestVolume ? current : best;
            }, exchangeTickers[0]);

            const price = bestTicker.converted_last?.usd || bestTicker.last;
            const volume24h = bestTicker.converted_volume?.usd || 0;
            const bidAskSpread = bestTicker.bid_ask_spread_percentage || 0;

            pricesData[symbol].exchanges[exchangeKey] = {
              exchange: exchange,
              price: price,
              volume24h: volume24h,
              bidAskSpread: bidAskSpread,
              pair: `${symbol}/${bestTicker.target}`,
              lastUpdated: bestTicker.last_traded_at || new Date().toISOString(),
              trustScore: bestTicker.trust_score,
            };

            // Track best buy/sell
            if (price < lowestPrice) {
              lowestPrice = price;
              lowestExchange = exchangeKey;
            }
            if (price > highestPrice) {
              highestPrice = price;
              highestExchange = exchangeKey;
            }
          } else {
            // Exchange doesn't have this pair or not enough data
            pricesData[symbol].exchanges[exchangeKey] = {
              exchange: exchange,
              price: null,
              volume24h: null,
              error: 'Pair not available',
            };
          }
        }

        // Calculate arbitrage opportunity
        if (lowestExchange && highestExchange && lowestPrice < Infinity && highestPrice > 0) {
          const spreadPercent = ((highestPrice - lowestPrice) / lowestPrice) * 100;
          const spreadUsd = highestPrice - lowestPrice;

          pricesData[symbol].spread = {
            percent: spreadPercent,
            usd: spreadUsd,
          };
          pricesData[symbol].bestBuy = {
            exchange: lowestExchange,
            price: lowestPrice,
          };
          pricesData[symbol].bestSell = {
            exchange: highestExchange,
            price: highestPrice,
          };

          // Flag as opportunity if spread > 0.5%
          if (spreadPercent > 0.5) {
            arbitrageOpportunities.push({
              crypto: symbol,
              buyExchange: lowestExchange,
              buyPrice: lowestPrice,
              sellExchange: highestExchange,
              sellPrice: highestPrice,
              spreadPercent: spreadPercent,
              spreadUsd: spreadUsd,
            });
          }
        }

      } catch (fetchError) {
        console.error(`Error fetching ${symbol} prices:`, fetchError);
      }
    }

    // Sort opportunities by spread
    arbitrageOpportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      prices: pricesData,
      opportunities: arbitrageOpportunities,
      meta: {
        cryptos: validCryptos.map(c => CRYPTOCURRENCIES[c]),
        exchanges: validExchanges.map(e => EXCHANGES[e]),
      },
    });

  } catch (error) {
    console.error('Exchange prices error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch exchange prices' },
      { status: 500 }
    );
  }
}

// Export available exchanges and cryptos for the frontend
export async function OPTIONS() {
  return NextResponse.json({
    exchanges: Object.entries(EXCHANGES).map(([key, value]) => ({
      key,
      ...value,
    })),
    cryptocurrencies: Object.entries(CRYPTOCURRENCIES).map(([key, value]) => ({
      key,
      ...value,
    })),
  });
}
