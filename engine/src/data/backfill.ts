/**
 * Historical Data Backfill
 * Fetches historical candles from Coinbase REST API and inserts into database
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Candle } from '../types';

interface BackfillParams {
  supabaseClient: SupabaseClient;
  symbol: string;
  timeframe: string;
  requiredCandles: number;
}

interface BackfillResult {
  ok: boolean;
  reason?: string;
  candlesInserted?: number;
}

/**
 * Fetch historical candles from Coinbase REST API
 */
async function fetchHistoricalCandles(
  symbol: string,
  timeframe: string,
  startTime: Date,
  endTime: Date
): Promise<Candle[]> {
  // Convert timeframe to Coinbase granularity
  const granularityMap: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
  };

  const granularity = granularityMap[timeframe];
  if (!granularity) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  const url = `https://api.exchange.coinbase.com/products/${symbol}/candles?start=${startTime.toISOString()}&end=${endTime.toISOString()}&granularity=${granularity}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Coinbase API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as number[][];

  // Coinbase returns: [timestamp, low, high, open, close, volume]
  return data
    .map((row: number[]) => ({
      productId: symbol,
      timeframe,
      timestamp: new Date(row[0] * 1000), // Convert Unix seconds to Date
      open: row[3],
      high: row[2],
      low: row[1],
      close: row[4],
      volume: row[5],
    }))
    .reverse(); // Coinbase returns newest first, we want oldest first
}

/**
 * Check how many candles we have for a symbol/timeframe
 */
async function getCandleCount(
  supabaseClient: SupabaseClient,
  symbol: string,
  timeframe: string
): Promise<number> {
  const { count, error } = await supabaseClient
    .from('crypto_candles')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', symbol)
    .eq('timeframe', timeframe);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get the earliest candle timestamp for a symbol/timeframe
 */
async function getEarliestCandle(
  supabaseClient: SupabaseClient,
  symbol: string,
  timeframe: string
): Promise<Date | null> {
  const { data, error } = await supabaseClient
    .from('crypto_candles')
    .select('time')
    .eq('product_id', symbol)
    .eq('timeframe', timeframe)
    .order('time', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No candles found
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data ? new Date(data.time) : null;
}

/**
 * Backfill historical candles if needed
 */
export async function backfillIfNeeded({
  supabaseClient,
  symbol,
  timeframe,
  requiredCandles,
}: BackfillParams): Promise<BackfillResult> {
  try {
    // Check current candle count
    const currentCount = await getCandleCount(supabaseClient, symbol, timeframe);

    if (currentCount >= requiredCandles) {
      return {
        ok: true,
        candlesInserted: 0,
      };
    }

    const candlesNeeded = requiredCandles - currentCount;
    const now = new Date();

    // Calculate how far back we need to go
    const timeframeMs: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const intervalMs = timeframeMs[timeframe];
    if (!intervalMs) {
      return {
        ok: false,
        reason: `Unsupported timeframe: ${timeframe}`,
      };
    }

    // Get earliest existing candle, or start from required time back
    const earliestExisting = await getEarliestCandle(supabaseClient, symbol, timeframe);
    const requiredStartTime = new Date(now.getTime() - requiredCandles * intervalMs);

    // Start from the earlier of: required time or earliest existing - 1 interval
    const startTime = earliestExisting
      ? new Date(Math.min(earliestExisting.getTime() - intervalMs, requiredStartTime.getTime()))
      : requiredStartTime;

    // Fetch in batches (Coinbase limits to 300 candles per request)
    const batchSize = 300;
    const batches = Math.ceil(candlesNeeded / batchSize);
    let totalInserted = 0;

    console.log(
      `[Backfill] ${symbol} ${timeframe}: Need ${candlesNeeded} candles, fetching from ${startTime.toISOString()}`
    );

    for (let i = 0; i < batches; i++) {
      const batchStart = new Date(startTime.getTime() + i * batchSize * intervalMs);
      const batchEnd = new Date(
        Math.min(batchStart.getTime() + batchSize * intervalMs, now.getTime())
      );

      if (batchStart >= now) {
        break;
      }

      const candles = await fetchHistoricalCandles(symbol, timeframe, batchStart, batchEnd);

      if (candles.length === 0) {
        continue;
      }

      // Insert candles
      const rows = candles.map((candle) => ({
        product_id: candle.productId,
        timeframe: candle.timeframe,
        time: candle.timestamp.toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }));

      const { error } = await supabaseClient.from('crypto_candles').upsert(rows, {
        onConflict: 'product_id,timeframe,time',
        ignoreDuplicates: false,
      });

      if (error) {
        return {
          ok: false,
          reason: `Failed to insert candles: ${error.message}`,
        };
      }

      totalInserted += candles.length;
      console.log(
        `[Backfill] ${symbol} ${timeframe}: Inserted ${candles.length} candles (batch ${i + 1}/${batches})`
      );

      // Rate limit: Coinbase allows 10 requests per second
      if (i < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms = 5 req/sec
      }
    }

    return {
      ok: true,
      candlesInserted: totalInserted,
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: `Backfill error: ${error.message || String(error)}`,
    };
  }
}

