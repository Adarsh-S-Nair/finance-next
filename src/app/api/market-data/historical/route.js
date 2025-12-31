import { NextResponse } from 'next/server';

/**
 * Fetch historical stock prices for specific dates
 * GET /api/market-data/historical?ticker=QQQ&dates=2025-01-01,2025-01-02,2025-01-03
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const datesParam = searchParams.get('dates');

    if (!ticker || !datesParam) {
      return NextResponse.json(
        { error: 'Ticker and dates are required' },
        { status: 400 }
      );
    }

    const dates = datesParam.split(',').filter(d => d);
    if (dates.length === 0) {
      return NextResponse.json(
        { error: 'At least one date is required' },
        { status: 400 }
      );
    }

    // Parse dates and find the range
    const dateObjects = dates.map(d => new Date(d));
    const sortedDates = [...dateObjects].sort((a, b) => a - b);
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];

    // Add a few days buffer to ensure we get data
    const startTimestamp = Math.floor((startDate.getTime() - 3 * 24 * 60 * 60 * 1000) / 1000);
    const endTimestamp = Math.floor((endDate.getTime() + 3 * 24 * 60 * 60 * 1000) / 1000);

    // Fetch historical data from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${startTimestamp}&period2=${endTimestamp}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`[Historical ${ticker}] Yahoo API returned ${response.status}`);
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

    // Create a map of date string to price
    // Use local date string based on market timezone (US/Eastern approximation)
    const priceMap = {};
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000);
        // Adjust for market timezone - Yahoo returns timestamps in local market time
        // For US stocks, the close timestamp is typically around 4pm ET
        // Using toLocaleDateString to get a consistent date representation
        const dateString = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        priceMap[dateString] = closes[i];
      }
    }

    // For each requested date, find the closest available price
    // If exact date not found, use the previous trading day's price
    const prices = {};
    const dateSet = new Set(dates);

    dates.forEach(dateStr => {
      if (priceMap[dateStr]) {
        // Exact match
        prices[dateStr] = priceMap[dateStr];
      } else {
        // Find the closest previous trading day
        const targetDate = new Date(dateStr);
        let foundPrice = null;
        let closestDate = null;
        let minDiff = Infinity;

        Object.keys(priceMap).forEach(priceDateStr => {
          const priceDate = new Date(priceDateStr);
          if (priceDate <= targetDate) {
            const diff = targetDate - priceDate;
            if (diff < minDiff) {
              minDiff = diff;
              foundPrice = priceMap[priceDateStr];
              closestDate = priceDateStr;
            }
          }
        });

        if (foundPrice !== null) {
          prices[dateStr] = foundPrice;
        }
      }
    });

    // Log benchmark prices for QQQ to verify data accuracy
    if (ticker === 'QQQ') {
      const sortedPriceEntries = Object.entries(prices).sort(([a], [b]) => a.localeCompare(b));
      console.log(`[Benchmark QQQ] Historical closing prices for ${dates.length} date(s):`);
      sortedPriceEntries.forEach(([date, price]) => {
        console.log(`  ${date}: $${price.toFixed(2)}`);
      });
    }

    // Log historical prices for debugging
    const sortedPrices = Object.entries(prices).sort(([a], [b]) => a.localeCompare(b));
    console.log(`[Historical ${ticker}] Returning prices for ${sortedPrices.length} dates:`, 
      sortedPrices.map(([date, price]) => `${date}: $${price.toFixed(2)}`).join(', '));

    return NextResponse.json({
      ticker,
      prices,
    });

  } catch (error) {
    console.error('[Historical] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



