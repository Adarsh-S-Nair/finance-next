import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * Fetch historical stock/crypto prices for a time range with specified interval
 * GET /api/market-data/historical-range?ticker=CRM&start=1703548800&end=1703808000&interval=1h
 * 
 * Intervals: 1m, 5m, 15m, 30m, 1h, 1d
 * Note: Yahoo Finance limits intraday data to last 7 days for 1m, 60 days for other intraday intervals
 * 
 * For crypto tickers (detected from DB), automatically appends -USD suffix for Yahoo Finance.
 * Falls back to CoinGecko for crypto if Yahoo fails.
 */

// CoinGecko ID mapping for common crypto tickers
const COINGECKO_ID_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'DOGE': 'dogecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'AVAX': 'avalanche-2',
  'MATIC': 'matic-network',
  'POL': 'matic-network',
  'ATOM': 'cosmos',
  'LTC': 'litecoin',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe',
  'TRX': 'tron',
  'BCH': 'bitcoin-cash',
  'XLM': 'stellar',
  'NEAR': 'near',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'SUI': 'sui',
  'TON': 'the-open-network',
  'FIL': 'filecoin',
  'AAVE': 'aave',
  'FTM': 'fantom',
  'ALGO': 'algorand',
  'BNB': 'binancecoin',
};

/**
 * Fetch historical data from CoinGecko (fallback for crypto)
 * @param {string} ticker - Crypto ticker
 * @param {number} startTimestamp - Unix timestamp (seconds)
 * @param {number} endTimestamp - Unix timestamp (seconds)
 * @returns {Promise<Array|null>}
 */
async function fetchHistoricalFromCoinGecko(ticker, startTimestamp, endTimestamp) {
  const coinId = COINGECKO_ID_MAP[ticker.toUpperCase()];
  
  if (!coinId) {
    // Try to search for the coin
    try {
      const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`;
      const searchResponse = await fetch(searchUrl, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const coin = searchData.coins?.find(c => c.symbol.toUpperCase() === ticker.toUpperCase());
        if (coin) {
          return await fetchCoinGeckoMarketChart(coin.id, startTimestamp, endTimestamp);
        }
      }
    } catch (e) {
      console.log(`[CoinGecko Historical] Search failed for ${ticker}:`, e.message);
    }
    return null;
  }
  
  return await fetchCoinGeckoMarketChart(coinId, startTimestamp, endTimestamp);
}

async function fetchCoinGeckoMarketChart(coinId, startTimestamp, endTimestamp) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${startTimestamp}&to=${endTimestamp}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`[CoinGecko Historical] API returned ${response.status} for ${coinId}`);
      return null;
    }
    
    const data = await response.json();
    const prices = data.prices || [];
    
    if (prices.length === 0) {
      return null;
    }
    
    // CoinGecko returns [timestamp_ms, price] pairs
    const formattedPrices = prices.map(([timestamp, price]) => ({
      timestamp: Math.floor(timestamp / 1000),
      price
    }));
    
    console.log(`[CoinGecko Historical] ${coinId}: Got ${formattedPrices.length} data points`);
    return formattedPrices;
  } catch (error) {
    console.log(`[CoinGecko Historical] Error fetching ${coinId}:`, error.message);
    return null;
  }
}
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

    let prices = [];
    let source = 'yahoo';

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (result) {
          const timestamps = result.timestamp || [];
          const closes = result.indicators?.quote?.[0]?.close || [];

          // Build array of {timestamp, price} pairs
          for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] !== null && closes[i] !== undefined) {
              prices.push({
                timestamp: timestamps[i],
                price: closes[i]
              });
            }
          }
        }
      }
    } catch (yahooError) {
      console.log(`[Historical-Range ${ticker}] Yahoo fetch error:`, yahooError.message);
    }

    // If Yahoo failed or returned no data for crypto, try CoinGecko
    if (prices.length === 0 && isCrypto) {
      console.log(`[Historical-Range ${ticker}] Yahoo returned no data, trying CoinGecko...`);
      const coinGeckoPrices = await fetchHistoricalFromCoinGecko(ticker, startTimestamp, endTimestamp);
      if (coinGeckoPrices && coinGeckoPrices.length > 0) {
        prices = coinGeckoPrices;
        source = 'coingecko';
      }
    }

    if (prices.length === 0) {
      return NextResponse.json(
        { error: 'No historical data available' },
        { status: 404 }
      );
    }

    const assetType = isCrypto ? '🪙 Crypto' : '📊 Stock';
    console.log(`[Historical-Range ${ticker}] ${assetType} Fetched ${prices.length} data points from ${source} (interval: ${interval})${isCrypto ? ` (ticker: ${yahooTicker})` : ''}`);

    return NextResponse.json({
      ticker,
      interval,
      prices,
      source,
    });

  } catch (error) {
    console.error('[Historical-Range] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


