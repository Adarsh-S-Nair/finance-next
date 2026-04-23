/**
 * Stock & Crypto Quotes API - Fetches current prices with in-memory caching only
 *
 * GET /api/market-data/quotes?tickers=AAPL,MSFT,NVDA,BTC,ETH
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  price: number;
  updatedAt: string;
}

const inMemoryCache = new Map<string, CacheEntry>();

const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', DOGE: 'dogecoin', XRP: 'ripple',
  ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2', MATIC: 'matic-network',
  POL: 'matic-network', ATOM: 'cosmos', LTC: 'litecoin', LINK: 'chainlink',
  UNI: 'uniswap', SHIB: 'shiba-inu', PEPE: 'pepe', TRX: 'tron', BCH: 'bitcoin-cash',
  XLM: 'stellar', NEAR: 'near', APT: 'aptos', ARB: 'arbitrum', OP: 'optimism',
  SUI: 'sui', TON: 'the-open-network', FIL: 'filecoin', AAVE: 'aave',
  MKR: 'maker', CRV: 'curve-dao-token', SNX: 'synthetix-network-token',
  COMP: 'compound-coin', GRT: 'the-graph', SAND: 'the-sandbox',
  MANA: 'decentraland', AXS: 'axie-infinity', APE: 'apecoin', LDO: 'lido-dao',
  ENS: 'ethereum-name-service', '1INCH': '1inch', BAT: 'basic-attention-token',
  FTM: 'fantom', ALGO: 'algorand', VET: 'vechain', HBAR: 'hedera-hashgraph',
  ETC: 'ethereum-classic', XMR: 'monero', ICP: 'internet-computer',
  XTZ: 'tezos', EOS: 'eos', THETA: 'theta-token', CRO: 'crypto-com-chain',
  INJ: 'injective-protocol', SEI: 'sei-network', RENDER: 'render-token',
  IMX: 'immutable-x', BNB: 'binancecoin',
};

async function fetchPriceFromCoinGecko(ticker: string): Promise<number | null> {
  const coinId = COINGECKO_ID_MAP[ticker.toUpperCase()];

  if (!coinId) {
    try {
      const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`;
      const searchResponse = await fetch(searchUrl, { headers: { Accept: 'application/json' } });

      if (searchResponse.ok) {
        const searchData = (await searchResponse.json()) as {
          coins?: { id: string; symbol: string }[];
        };
        const coin = searchData.coins?.find(
          (c) => c.symbol.toUpperCase() === ticker.toUpperCase()
        );
        if (coin) {
          const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`;
          const priceResponse = await fetch(priceUrl, {
            headers: { Accept: 'application/json' },
          });

          if (priceResponse.ok) {
            const priceData = (await priceResponse.json()) as Record<string, { usd?: number }>;
            const price = priceData[coin.id]?.usd;
            if (price !== undefined) {
              console.log(`[CoinGecko] Found ${ticker} via search: $${price}`);
              return price;
            }
          }
        }
      }
    } catch (e) {
      console.log(
        `[CoinGecko] Search failed for ${ticker}:`,
        e instanceof Error ? e.message : String(e)
      );
    }
    return null;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      console.log(`[CoinGecko] API returned ${response.status} for ${ticker}`);
      return null;
    }

    const data = (await response.json()) as Record<string, { usd?: number }>;
    const price = data[coinId]?.usd;

    if (price !== undefined) {
      console.log(`[CoinGecko] ${ticker}: $${price}`);
      return price;
    }

    return null;
  } catch (error) {
    console.log(
      `[CoinGecko] Error fetching ${ticker}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function fetchQuoteFromYahoo(ticker: string, isCrypto = false): Promise<number | null> {
  const yahooTicker = isCrypto ? `${ticker}-USD` : ticker;

  try {
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`;

    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (quoteResponse.ok) {
      const quoteData = (await quoteResponse.json()) as {
        quoteResponse?: {
          result?: Array<{
            postMarketPrice?: number | null;
            regularMarketPrice?: number | null;
          }>;
        };
      };
      const quoteResult = quoteData.quoteResponse?.result?.[0];

      if (quoteResult) {
        const price = quoteResult.postMarketPrice ?? quoteResult.regularMarketPrice;

        if (price !== null && price !== undefined) {
          const priceSource =
            quoteResult.postMarketPrice !== null && quoteResult.postMarketPrice !== undefined
              ? 'postMarket'
              : 'regularMarket';
          const assetType = isCrypto ? '🪙 Crypto' : '📊 Stock';
          console.log(
            `[Quote ${ticker}] ${assetType} Using ${priceSource} price: ${price}${
              isCrypto ? ` (fetched as ${yahooTicker})` : ''
            }`
          );
          return price;
        }
      }
    }

    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 2 * 24 * 60 * 60;

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&period1=${startDate}&period2=${endDate}`;

    const chartResponse = await fetch(chartUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!chartResponse.ok) {
      console.log(
        `[Quote ${ticker}] Chart API returned ${chartResponse.status}${
          isCrypto ? ` (tried ${yahooTicker})` : ''
        }`
      );
      return null;
    }

    const chartData = (await chartResponse.json()) as {
      chart?: {
        result?: Array<{
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const result = chartData.chart?.result?.[0];

    if (!result) {
      console.log(`[Quote ${ticker}] No data in chart response`);
      return null;
    }

    const closes = result.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter((c): c is number => c !== null);

    if (validCloses.length === 0) {
      console.log(`[Quote ${ticker}] No valid price data`);
      return null;
    }

    const currentPrice = validCloses[validCloses.length - 1];
    const assetType = isCrypto ? '🪙 Crypto' : '📊 Stock';
    console.log(`[Quote ${ticker}] ${assetType} Using chart close price: ${currentPrice}`);
    return currentPrice;
  } catch (error) {
    console.error(
      `[Quote ${ticker}] Error:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get('tickers');

    if (!tickersParam) {
      return NextResponse.json({ error: 'Missing tickers parameter' }, { status: 400 });
    }

    const tickers = tickersParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);

    if (tickers.length === 0) {
      return NextResponse.json({ error: 'No valid tickers provided' }, { status: 400 });
    }

    if (tickers.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 tickers per request' }, { status: 400 });
    }

    const cryptoTickers = new Set<string>();
    const cashTickers = new Set<string>();
    const foundTickers = new Set<string>();

    try {
      const { data: tickerData } = await supabaseAdmin
        .from('tickers')
        .select('symbol, asset_type')
        .in('symbol', tickers);

      if (tickerData) {
        tickerData.forEach((t) => {
          foundTickers.add(t.symbol);
          if (t.asset_type === 'crypto') cryptoTickers.add(t.symbol);
          else if (t.asset_type === 'cash') cashTickers.add(t.symbol);
        });
      }

      const missingTickers = tickers.filter((t) => !foundTickers.has(t));
      if (missingTickers.length > 0) {
        const { data: holdingsData } = await supabaseAdmin
          .from('holdings')
          .select('ticker, asset_type')
          .in('ticker', missingTickers);

        if (holdingsData) {
          holdingsData.forEach((h) => {
            if (h.asset_type === 'crypto') cryptoTickers.add(h.ticker);
            else if (h.asset_type === 'cash') cashTickers.add(h.ticker);
          });
          if (holdingsData.length > 0) {
            console.log(
              `[Quotes] Found ${holdingsData.length} tickers in holdings table:`,
              holdingsData.map((h) => `${h.ticker}(${h.asset_type})`)
            );
          }
        }
      }

      tickers.forEach((t) => {
        if (t.startsWith('CUR:') && !cashTickers.has(t)) {
          cashTickers.add(t);
        }
      });

      if (cryptoTickers.size > 0) {
        console.log(
          `[Quotes] Detected ${cryptoTickers.size} crypto tickers:`,
          Array.from(cryptoTickers)
        );
      }
      if (cashTickers.size > 0) {
        console.log(
          `[Quotes] Detected ${cashTickers.size} cash tickers:`,
          Array.from(cashTickers)
        );
      }
    } catch (dbError) {
      console.warn(
        '[Quotes] Could not look up asset types from DB:',
        dbError instanceof Error ? dbError.message : String(dbError)
      );
    }

    const nonCashTickers = tickers.filter((t) => !cashTickers.has(t));

    const now = new Date();
    const cacheThreshold = now.getTime() - CACHE_TTL_MS;

    const quotes: Record<string, { price: number; cached: boolean; cachedAt: string }> = {};
    const cachedTickers = new Set<string>();

    cashTickers.forEach((ticker) => {
      quotes[ticker] = { price: 1.0, cached: true, cachedAt: now.toISOString() };
      inMemoryCache.set(ticker, { price: 1.0, updatedAt: now.toISOString() });
      cachedTickers.add(ticker);
    });

    nonCashTickers.forEach((ticker) => {
      const cached = inMemoryCache.get(ticker);
      if (!cached) return;

      const updatedTime = new Date(cached.updatedAt).getTime();
      if (updatedTime >= cacheThreshold) {
        quotes[ticker] = {
          price: cached.price,
          cached: true,
          cachedAt: cached.updatedAt,
        };
        cachedTickers.add(ticker);
      }
    });

    const staleTickers = nonCashTickers.filter((t) => !cachedTickers.has(t));

    if (staleTickers.length > 0) {
      console.log(
        `[Quotes] Fetching fresh prices for ${staleTickers.length} tickers: ${staleTickers.join(', ')}`
      );

      const freshPrices = await Promise.all(
        staleTickers.map(async (ticker) => {
          const isCrypto = cryptoTickers.has(ticker);

          let price = await fetchQuoteFromYahoo(ticker, isCrypto);

          if (price === null && isCrypto) {
            console.log(`[Quotes] Yahoo failed for ${ticker}, trying CoinGecko...`);
            price = await fetchPriceFromCoinGecko(ticker);
          }

          return { ticker, price };
        })
      );

      freshPrices.forEach(({ ticker, price }) => {
        if (price !== null) {
          const updatedAt = now.toISOString();
          console.log('[Quotes] Fresh price fetched', { ticker, price, updatedAt });
          quotes[ticker] = {
            price,
            cached: false,
            cachedAt: updatedAt,
          };

          inMemoryCache.set(ticker, {
            price,
            updatedAt,
          });
        }
      });
    }

    return NextResponse.json({
      quotes,
      fromCache: cachedTickers.size,
      fetched: staleTickers.length,
      cryptoCount: cryptoTickers.size,
      cacheTTL: CACHE_TTL_MS / 1000 / 60 + ' minutes',
    });
  } catch (error) {
    console.error('Quotes API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
