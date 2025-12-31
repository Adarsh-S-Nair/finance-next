import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * Fetch historical stock/crypto prices for a time range with specified interval
 * GET /api/market-data/historical-range?ticker=CRM&start=1703548800&end=1703808000&interval=1h
 * 
 * Intervals: 1m, 5m, 15m, 30m, 1h, 1d
 * Note: Yahoo Finance limits intraday data to last 7 days for 1m, 60 days for other intraday intervals
 * 
 * For crypto tickers (detected from DB), automatically appends -USD suffix for Yahoo Finance
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();
    const startTimestamp = searchParams.get('start');
    const endTimestamp = searchParams.get('end');
    const interval = searchParams.get('interval') || '1h';

    if (!ticker || !startTimestamp || !endTimestamp) {
      return NextResponse.json(
        { error: 'Ticker, start, and end timestamps are required' },
        { status: 400 }
      );
    }

    // Validate interval
    const validIntervals = ['1m', '5m', '15m', '30m', '1h', '1d'];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json(
        { error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if this is a crypto ticker from our database
    let isCrypto = false;
    try {
      const { data: tickerData } = await supabaseAdmin
        .from('tickers')
        .select('asset_type')
        .eq('symbol', ticker)
        .single();
      
      if (tickerData?.asset_type === 'crypto') {
        isCrypto = true;
        console.log(`[Historical-Range ${ticker}] Detected as crypto, will use ${ticker}-USD`);
      }
    } catch (dbError) {
      // If DB lookup fails, continue assuming stock
      console.warn(`[Historical-Range ${ticker}] Could not look up asset type:`, dbError.message);
    }

    // For crypto, Yahoo Finance uses format like BTC-USD
    const yahooTicker = isCrypto ? `${ticker}-USD` : ticker;

    // Fetch historical data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${interval}&period1=${startTimestamp}&period2=${endTimestamp}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`[Historical-Range ${ticker}] Yahoo API returned ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch historical data' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return NextResponse.json(
        { error: 'No data in response' },
        { status: 500 }
      );
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    // Build array of {timestamp, price} pairs
    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        prices.push({
          timestamp: timestamps[i],
          price: closes[i]
        });
      }
    }

    const assetType = isCrypto ? '🪙 Crypto' : '📊 Stock';
    console.log(`[Historical-Range ${ticker}] ${assetType} Fetched ${prices.length} data points (interval: ${interval})${isCrypto ? ` (from ${yahooTicker})` : ''}`);

    return NextResponse.json({
      ticker,
      interval,
      prices,
    });

  } catch (error) {
    console.error('[Historical-Range] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


