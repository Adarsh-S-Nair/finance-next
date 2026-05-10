/**
 * Live quote fetcher for stocks, crypto, and cash positions.
 *
 * Originally lived inside `/api/market-data/quotes/route.ts`. Extracted
 * here so server-side callers (e.g. agent tools that need current
 * portfolio values) can hit the same logic without going through an
 * internal HTTP loopback.
 *
 * Lookup order per ticker:
 *   1. In-memory cache (5-min TTL). Shared across all callers in this
 *      process — multiple agent calls within a few minutes hit the
 *      cache, same as the dashboard does.
 *   2. Cash detection (asset_type = 'cash' or symbol prefix 'CUR:') →
 *      hard-coded $1.00.
 *   3. Yahoo Finance (postMarket then regularMarket, then chart close).
 *      Works for both stocks (TICKER) and crypto (TICKER-USD).
 *   4. CoinGecko (crypto only, when Yahoo fails) — covers stuff Yahoo
 *      doesn't list (DOGE, SHIB, etc).
 *
 * Returns null for any ticker that all sources fail on. Callers should
 * fall back to cost basis or surface "price unavailable" to the user.
 */
import { supabaseAdmin } from './supabase/admin';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  price: number;
  updatedAt: string;
}

// Process-wide cache. Survives across requests within a single
// serverless instance; cold-starts wipe it. Good enough — we just
// don't want to hammer Yahoo on every dashboard load + every agent
// turn.
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

export interface QuoteResult {
  price: number;
  cached: boolean;
  cachedAt: string;
}

export interface FetchQuotesResult {
  quotes: Record<string, QuoteResult>;
  fromCache: number;
  fetched: number;
  cryptoCount: number;
}

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
            if (price !== undefined) return price;
          }
        }
      }
    } catch {
      // Ignore — caller falls back to cost basis.
    }
    return null;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, { usd?: number }>;
    return data[coinId]?.usd ?? null;
  } catch {
    return null;
  }
}

async function fetchQuoteFromYahoo(
  ticker: string,
  isCrypto = false,
): Promise<number | null> {
  const yahooTicker = isCrypto ? `${ticker}-USD` : ticker;

  try {
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`;
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
        if (price !== null && price !== undefined) return price;
      }
    }

    // Quote endpoint can come back empty for some tickers; chart endpoint
    // is the reliable backup. We take the most recent valid close.
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 2 * 24 * 60 * 60;
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&period1=${startDate}&period2=${endDate}`;
    const chartResponse = await fetch(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!chartResponse.ok) return null;
    const chartData = (await chartResponse.json()) as {
      chart?: {
        result?: Array<{
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const closes = chartData.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter((c): c is number => c !== null);
    if (validCloses.length === 0) return null;
    return validCloses[validCloses.length - 1];
  } catch {
    return null;
  }
}

/**
 * Fetch live (or recently-cached) USD prices for a batch of tickers.
 * Handles asset-type classification (stock / crypto / cash) automatically
 * by joining against the tickers and holdings tables.
 *
 * Always returns a result map keyed by the input ticker (uppercased).
 * Missing keys = price unavailable.
 */
export async function fetchQuotesForTickers(
  rawTickers: string[],
): Promise<FetchQuotesResult> {
  const tickers = Array.from(
    new Set(rawTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  );

  if (tickers.length === 0) {
    return { quotes: {}, fromCache: 0, fetched: 0, cryptoCount: 0 };
  }

  // Classify by asset type. First check the tickers table (authoritative
  // for known symbols), fall back to the holdings table for anything
  // not yet seeded there. CUR:* symbols are always cash.
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
      }
    }

    tickers.forEach((t) => {
      if (t.startsWith('CUR:') && !cashTickers.has(t)) {
        cashTickers.add(t);
      }
    });
  } catch (dbError) {
    console.warn(
      '[quotes] DB asset-type lookup failed, treating all as stocks:',
      dbError instanceof Error ? dbError.message : String(dbError),
    );
  }

  const now = new Date();
  const cacheThreshold = now.getTime() - CACHE_TTL_MS;
  const quotes: Record<string, QuoteResult> = {};
  const cachedTickers = new Set<string>();
  const nonCashTickers = tickers.filter((t) => !cashTickers.has(t));

  // Cash is always $1.
  cashTickers.forEach((ticker) => {
    quotes[ticker] = { price: 1.0, cached: true, cachedAt: now.toISOString() };
    inMemoryCache.set(ticker, { price: 1.0, updatedAt: now.toISOString() });
    cachedTickers.add(ticker);
  });

  // Serve from in-memory cache when fresh.
  nonCashTickers.forEach((ticker) => {
    const cached = inMemoryCache.get(ticker);
    if (!cached) return;
    if (new Date(cached.updatedAt).getTime() >= cacheThreshold) {
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
    const freshPrices = await Promise.all(
      staleTickers.map(async (ticker) => {
        const isCrypto = cryptoTickers.has(ticker);
        let price = await fetchQuoteFromYahoo(ticker, isCrypto);
        if (price === null && isCrypto) {
          price = await fetchPriceFromCoinGecko(ticker);
        }
        return { ticker, price };
      }),
    );

    freshPrices.forEach(({ ticker, price }) => {
      if (price !== null) {
        const updatedAt = now.toISOString();
        quotes[ticker] = { price, cached: false, cachedAt: updatedAt };
        inMemoryCache.set(ticker, { price, updatedAt });
      }
    });
  }

  return {
    quotes,
    fromCache: cachedTickers.size,
    fetched: staleTickers.length,
    cryptoCount: cryptoTickers.size,
  };
}
