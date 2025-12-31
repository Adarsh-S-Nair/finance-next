/**
 * Fetch historical crypto candles from Coinbase Exchange API
 * Handles pagination (300 candle limit) by chunking requests
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Convert timeframe to Coinbase granularity (in seconds)
 */
function getGranularity(timeframe) {
  const granularityMap = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
  };
  return granularityMap[timeframe];
}

/**
 * Fetch candles from Coinbase for a single time window
 * Includes retry logic with exponential backoff for rate limits
 */
async function fetchCoinbaseCandles(productId, granularity, startTime, endTime, retryCount = 0) {
  const url = `https://api.exchange.coinbase.com/products/${productId}/candles?start=${startTime.toISOString()}&end=${endTime.toISOString()}&granularity=${granularity}`;

  const response = await fetch(url);

  // Handle rate limiting with exponential backoff
  if (response.status === 429 && retryCount < 3) {
    const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
    console.log(`Rate limited for ${productId}, retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchCoinbaseCandles(productId, granularity, startTime, endTime, retryCount + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Coinbase API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  // Coinbase returns: [timestamp (Unix seconds), low, high, open, close, volume]
  // Returns newest first, so we reverse to get oldest first
  return data
    .map((row) => ({
      time: new Date(row[0] * 1000).toISOString(), // Convert Unix seconds to ISO string
      open: parseFloat(row[3]),
      high: parseFloat(row[2]),
      low: parseFloat(row[1]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]) || 0,
    }))
    .reverse(); // Reverse to get oldest first
}

/**
 * Fetch all candles for a date range, handling pagination
 */
async function fetchAllCandles(productId, timeframe, startTime, endTime) {
  const granularity = getGranularity(timeframe);
  if (!granularity) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  // Calculate chunk size: 300 candles max per request
  // Adjust chunk size based on timeframe:
  // - 5m candles: 300 * 5 min = 25 hours, use 24 hours
  // - 1h candles: 300 * 60 min = 12.5 days, use 10 days
  // - 1d candles: 300 days, use 250 days
  const chunkMultipliers = {
    '5m': 24 * 60 * 60 * 1000,         // 24 hours
    '1h': 10 * 24 * 60 * 60 * 1000,    // 10 days
    '1d': 250 * 24 * 60 * 60 * 1000,   // 250 days
  };
  const chunkSizeMs = chunkMultipliers[timeframe] || 24 * 60 * 60 * 1000;
  const allCandles = [];
  const seenTimestamps = new Set(); // For deduplication

  let currentStart = new Date(startTime);
  const finalEnd = new Date(endTime);

  // Reduced logging

  while (currentStart < finalEnd) {
    const chunkEnd = new Date(Math.min(currentStart.getTime() + chunkSizeMs, finalEnd.getTime()));

    try {
      const candles = await fetchCoinbaseCandles(productId, granularity, currentStart, chunkEnd);

      // Deduplicate and filter to exact range
      candles.forEach((candle) => {
        const candleTime = new Date(candle.time);
        if (
          candleTime >= startTime &&
          candleTime <= endTime &&
          !seenTimestamps.has(candle.time)
        ) {
          seenTimestamps.add(candle.time);
          allCandles.push(candle);
        }
      });

      // Rate limiting: Coinbase allows 10 requests per second
      // Increase delay to 500ms (2 req/sec) to be safer with multiple products
      if (chunkEnd < finalEnd) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms between chunks
      }

      // Move to next chunk
      currentStart = new Date(chunkEnd.getTime() + 1); // +1ms to avoid overlap
    } catch (error) {
      console.error(`Error fetching candles for ${productId} chunk ${currentStart.toISOString()}:`, error);
      // Continue with next chunk instead of failing completely
      currentStart = new Date(chunkEnd.getTime() + 1);
    }
  }

  // Sort by time to ensure chronological order
  allCandles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Log summary
  if (allCandles.length > 0) {
    console.log(`  → ${productId} ${timeframe}: ${allCandles.length} candles from ${allCandles[0].time} to ${allCandles[allCandles.length - 1].time}`);
  } else {
    console.log(`  → ${productId} ${timeframe}: 0 candles returned`);
  }

  return allCandles;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const products = searchParams.get('products'); // Comma-separated: BTC-USD,ETH-USD
    const timeframe = searchParams.get('timeframe') || '5m';
    const startTime = searchParams.get('startTime'); // ISO timestamp
    const endTime = searchParams.get('endTime'); // ISO timestamp

    if (!products) {
      return NextResponse.json(
        { error: 'Missing required parameter: products' },
        { status: 400 }
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required parameters: startTime and endTime' },
        { status: 400 }
      );
    }

    const productList = products.split(',').map((p) => p.trim()).filter(Boolean);
    if (productList.length === 0) {
      return NextResponse.json(
        { error: 'No valid products provided' },
        { status: 400 }
      );
    }

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '6h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` },
        { status: 400 }
      );
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    if (startDateTime >= endDateTime) {
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      );
    }

    // Reduced logging to prevent flooding

    // Fetch candles for products SEQUENTIALLY to avoid rate limiting
    // (Concurrent fetches were causing 429 errors with Coinbase's public API)
    const candlesByProduct = {};

    for (const productId of productList) {
      try {
        console.log(`Fetching ${timeframe} candles for ${productId}...`);
        const candles = await fetchAllCandles(
          productId,
          timeframe,
          startDateTime,
          endDateTime
        );
        candlesByProduct[productId] = candles;
        console.log(`✓ Fetched ${candles.length} ${timeframe} candles for ${productId}`);

        // Add delay between products to avoid rate limiting
        if (productList.indexOf(productId) < productList.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s between products
        }
      } catch (error) {
        console.error(`Error fetching candles for ${productId}:`, error);
        candlesByProduct[productId] = []; // Return empty array on error
      }
    }

    return NextResponse.json({
      candles: candlesByProduct,
      timeframe,
      products: productList,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    });
  } catch (error) {
    console.error('Error in historical crypto candles API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch historical crypto candles' },
      { status: 500 }
    );
  }
}

