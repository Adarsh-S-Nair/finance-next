/**
 * Stock & Crypto Quotes API - Fetches current prices with in-memory caching only
 *
 * GET /api/market-data/quotes?tickers=AAPL,MSFT,NVDA,BTC,ETH
 *
 * Returns cached prices from an in-memory map if < 5 minutes old, otherwise fetches
 * fresh from Yahoo Finance. Automatically detects crypto tickers and appends -USD suffix.
 * No database reads or writes are performed here.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Cache TTL: 5 minutes (matches frontend refresh cadence)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Simple in-memory cache: { [ticker]: { price: number, updatedAt: string } }
// Note: This is per lambda/runtime instance and may be reset on cold starts,
// which is fine for our use case—it's only a performance optimization.
const inMemoryCache = new Map();

/**
 * Fetch quote from Yahoo Finance
 * For crypto tickers, automatically appends -USD suffix
 * @param {string} ticker - Original ticker symbol
 * @param {boolean} isCrypto - Whether this is a cryptocurrency
 * @returns {Promise<number|null>} Price or null if not found
 */
async function fetchQuoteFromYahoo(ticker, isCrypto = false) {
  // For crypto, Yahoo Finance uses format like BTC-USD, ETH-USD
  const yahooTicker = isCrypto ? `${ticker}-USD` : ticker;
  
  try {
    // Try quote endpoint first (has postMarketPrice, regularMarketPrice, etc.)
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooTicker}`;
    
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (quoteResponse.ok) {
      const quoteData = await quoteResponse.json();
      const quoteResult = quoteData.quoteResponse?.result?.[0];
      
      if (quoteResult) {
        // Prefer postMarketPrice if available (after-hours), otherwise regularMarketPrice
        // For crypto, regularMarketPrice is always current (24/7 trading)
        const price = quoteResult.postMarketPrice ?? quoteResult.regularMarketPrice;
        
        if (price !== null && price !== undefined) {
          const priceSource = quoteResult.postMarketPrice !== null && quoteResult.postMarketPrice !== undefined 
            ? 'postMarket' 
            : 'regularMarket';
          const assetType = isCrypto ? '🪙 Crypto' : '📊 Stock';
          console.log(`[Quote ${ticker}] ${assetType} Using ${priceSource} price: ${price}${isCrypto ? ` (fetched as ${yahooTicker})` : ''}`);
          return price;
        }
      }
    }

    // Fallback to chart endpoint if quote endpoint fails or has no price
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (2 * 24 * 60 * 60); // 2 days for safety

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&period1=${startDate}&period2=${endDate}`;

    const chartResponse = await fetch(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!chartResponse.ok) {
      console.log(`[Quote ${ticker}] Chart API returned ${chartResponse.status}${isCrypto ? ` (tried ${yahooTicker})` : ''}`);
      return null;
    }

    const chartData = await chartResponse.json();
    const result = chartData.chart?.result?.[0];

    if (!result) {
      console.log(`[Quote ${ticker}] No data in chart response`);
      return null;
    }

    // Get the most recent closing price
    const closes = result.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter(c => c !== null);

    if (validCloses.length === 0) {
      console.log(`[Quote ${ticker}] No valid price data`);
      return null;
    }

    const currentPrice = validCloses[validCloses.length - 1];
    const assetType = isCrypto ? '🪙 Crypto' : '📊 Stock';
    console.log(`[Quote ${ticker}] ${assetType} Using chart close price: ${currentPrice}`);
    return currentPrice;

  } catch (error) {
    console.error(`[Quote ${ticker}] Error:`, error.message);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get('tickers');

    if (!tickersParam) {
      return NextResponse.json(
        { error: 'Missing tickers parameter' },
        { status: 400 }
      );
    }

    const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

    if (tickers.length === 0) {
      return NextResponse.json(
        { error: 'No valid tickers provided' },
        { status: 400 }
      );
    }

    if (tickers.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 tickers per request' },
        { status: 400 }
      );
    }

    // Look up asset types from tickers table to determine crypto vs stock
    // This allows us to fetch crypto prices correctly (with -USD suffix for Yahoo)
    const cryptoTickers = new Set();
    try {
      const { data: tickerData } = await supabaseAdmin
        .from('tickers')
        .select('symbol, asset_type')
        .in('symbol', tickers);
      
      if (tickerData) {
        tickerData.forEach(t => {
          if (t.asset_type === 'crypto') {
            cryptoTickers.add(t.symbol);
          }
        });
      }
      
      if (cryptoTickers.size > 0) {
        console.log(`[Quotes] Detected ${cryptoTickers.size} crypto tickers:`, Array.from(cryptoTickers));
      }
    } catch (dbError) {
      // If DB lookup fails, continue without crypto detection
      console.warn('[Quotes] Could not look up asset types from DB:', dbError.message);
    }

    const now = new Date();
    const cacheThreshold = now.getTime() - CACHE_TTL_MS;

    // Build result map from in-memory cache
    const quotes = {};
    const cachedTickers = new Set();

    tickers.forEach((ticker) => {
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

    // Step 2: Identify tickers needing fresh data
    const staleTickers = tickers.filter(t => !cachedTickers.has(t));

    // Step 3: Fetch fresh prices for stale tickers
    if (staleTickers.length > 0) {
      console.log(
        `[Quotes] Fetching fresh prices for ${staleTickers.length} tickers: ${staleTickers.join(', ')}`
      );

      // Fetch in parallel (Yahoo Finance can handle it)
      const freshPrices = await Promise.all(
        staleTickers.map(async (ticker) => {
          const isCrypto = cryptoTickers.has(ticker);
          const price = await fetchQuoteFromYahoo(ticker, isCrypto);
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

          // Update in-memory cache only (no DB)
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
      cacheTTL: CACHE_TTL_MS / 1000 / 60 + ' minutes'
    });

  } catch (error) {
    console.error('Quotes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
