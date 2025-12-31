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

    // Check if this is a crypto or cash ticker from our database
    let isCrypto = false;
    let isCash = false;
    
    // Check for CUR: prefix pattern (legacy cash format)
    if (ticker.startsWith('CUR:')) {
      isCash = true;
      console.log(`[Historical-Range ${ticker}] Detected as cash (CUR: prefix), returning flat $1.00`);
    } else {
      try {
        // First, check tickers table
        const { data: tickerData } = await supabaseAdmin
          .from('tickers')
          .select('asset_type')
          .eq('symbol', ticker)
          .single();
        
        if (tickerData?.asset_type === 'crypto') {
          isCrypto = true;
          console.log(`[Historical-Range ${ticker}] Detected as crypto, will use ${ticker}-USD`);
        } else if (tickerData?.asset_type === 'cash') {
          isCash = true;
          console.log(`[Historical-Range ${ticker}] Detected as cash, returning flat $1.00`);
        }
      } catch (dbError) {
        // Ticker not in tickers table, check holdings table as fallback
        try {
          const { data: holdingData } = await supabaseAdmin
            .from('holdings')
            .select('asset_type')
            .eq('ticker', ticker)
            .limit(1)
            .single();
          
          if (holdingData?.asset_type === 'crypto') {
            isCrypto = true;
            console.log(`[Historical-Range ${ticker}] Detected as crypto (from holdings), will use ${ticker}-USD`);
          } else if (holdingData?.asset_type === 'cash') {
            isCash = true;
            console.log(`[Historical-Range ${ticker}] Detected as cash (from holdings), returning flat $1.00`);
          }
        } catch (holdingError) {
          // Neither table has it, assume stock
          console.warn(`[Historical-Range ${ticker}] Could not look up asset type from either table`);
        }
      }
    }

    // For cash tickers, return a flat line at $1.00
    if (isCash) {
      const start = parseInt(startTimestamp) * 1000;
      const end = parseInt(endTimestamp) * 1000;
      // Generate data points based on interval
      const intervalMs = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
      }[interval];
      
      const dataPoints = [];
      for (let ts = start; ts <= end; ts += intervalMs) {
        dataPoints.push({ time: Math.floor(ts / 1000), close: 1.0 });
      }
      
      console.log(`[Historical-Range ${ticker}] 💵 Cash Generated ${dataPoints.length} data points (interval: ${interval})`);
      return NextResponse.json({
        ticker,
        data: dataPoints,
      });
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


