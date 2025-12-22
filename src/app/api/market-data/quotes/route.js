/**
 * Stock Quotes API - Fetches current prices with caching
 * 
 * GET /api/market-data/quotes?tickers=AAPL,MSFT,NVDA
 * 
 * Returns cached prices if < 10 minutes old, otherwise fetches fresh from Yahoo Finance
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cache TTL: 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000;

// Lazy Supabase client
let supabaseAdmin = null;
function getSupabaseClient() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseAdmin;
}

/**
 * Fetch current price for a single ticker from Yahoo Finance
 */
async function fetchQuoteFromYahoo(ticker) {
  try {
    // Yahoo Finance v8 API - just get latest price
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (2 * 24 * 60 * 60); // 2 days for safety

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${startDate}&period2=${endDate}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.log(`[Quote ${ticker}] Yahoo API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      console.log(`[Quote ${ticker}] No data in response`);
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

    const supabase = getSupabaseClient();
    const now = new Date();
    const cacheThreshold = new Date(now.getTime() - CACHE_TTL_MS).toISOString();

    // Step 1: Check cache for all requested tickers
    const { data: cachedQuotes, error: cacheError } = await supabase
      .from('ticker_quotes')
      .select('ticker, current_price, updated_at')
      .in('ticker', tickers)
      .gte('updated_at', cacheThreshold);

    if (cacheError) {
      console.error('Cache lookup error:', cacheError);
      // Continue without cache if there's an error
    }

    // Build result map from cache
    const quotes = {};
    const cachedTickers = new Set();

    if (cachedQuotes && cachedQuotes.length > 0) {
      cachedQuotes.forEach(q => {
        quotes[q.ticker] = {
          price: parseFloat(q.current_price),
          cached: true,
          cachedAt: q.updated_at
        };
        cachedTickers.add(q.ticker);
      });
    }

    // Step 2: Identify tickers needing fresh data
    const staleTickers = tickers.filter(t => !cachedTickers.has(t));

    // Step 3: Fetch fresh prices for stale tickers
    if (staleTickers.length > 0) {
      console.log(`[Quotes] Fetching fresh prices for ${staleTickers.length} tickers: ${staleTickers.join(', ')}`);

      // Fetch in parallel (Yahoo Finance can handle it)
      const freshPrices = await Promise.all(
        staleTickers.map(async (ticker) => {
          const price = await fetchQuoteFromYahoo(ticker);
          return { ticker, price };
        })
      );

      // Prepare upserts for cache
      const upserts = [];

      freshPrices.forEach(({ ticker, price }) => {
        if (price !== null) {
          quotes[ticker] = {
            price,
            cached: false,
            cachedAt: now.toISOString()
          };

          upserts.push({
            ticker,
            current_price: price,
            updated_at: now.toISOString()
          });
        }
      });

      // Step 4: Cache the fresh prices
      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from('ticker_quotes')
          .upsert(upserts, { onConflict: 'ticker' });

        if (upsertError) {
          console.error('Cache upsert error:', upsertError);
          // Continue - caching failure shouldn't break the response
        } else {
          console.log(`[Quotes] Cached ${upserts.length} prices`);
        }
      }
    }

    return NextResponse.json({
      quotes,
      fromCache: cachedTickers.size,
      fetched: staleTickers.length,
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
