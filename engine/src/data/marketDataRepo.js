/**
 * Market Data Repository
 * Reads closed candles from the database
 */

const { timeframeToMs } = require("../utils/time");
const { dedupeCandlesByTimestamp, sortCandlesAsc, detectGaps } = require("../utils/candles");

/**
 * MarketDataRepository class for querying candle data
 */
class MarketDataRepository {
  /**
   * @param {Object} supabaseClient - Supabase client instance
   */
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("MarketDataRepository requires a Supabase client");
    }
    this.client = supabaseClient;
  }

  /**
   * Get the most recent candle that is guaranteed CLOSED
   * A candle is "closed" if its timestamp < (now - timeframeMs)
   * @param {Object} params - Query parameters
   * @param {string} params.symbol - Product ID (e.g., "BTC-USD")
   * @param {string} params.timeframe - Timeframe string (e.g., "1m", "5m", "1h", "1d")
   * @param {Date} params.now - Current timestamp
   * @returns {Promise<Object>} { ok: true, candle: {...} } or { ok: false, reason: string, candle: null }
   */
  async getLatestClosedCandle({ symbol, timeframe, now }) {
    try {
      if (!symbol || typeof symbol !== "string") {
        return { ok: false, reason: "INVALID_SYMBOL", candle: null };
      }

      if (!timeframe || typeof timeframe !== "string") {
        return { ok: false, reason: "INVALID_TIMEFRAME", candle: null };
      }

      if (!(now instanceof Date)) {
        return { ok: false, reason: "INVALID_NOW", candle: null };
      }

      const timeframeMs = timeframeToMs(timeframe);
      const closedBefore = new Date(now.getTime() - timeframeMs);

      // Query for the most recent candle before the closed threshold
      const { data, error } = await this.client
        .from("crypto_candles")
        .select("*")
        .eq("product_id", symbol)
        .eq("timeframe", timeframe)
        .lt("time", closedBefore.toISOString())
        .order("time", { ascending: false })
        .limit(1);

      if (error) {
        // Handle empty result gracefully (PGRST116 = no rows)
        if (error.code === "PGRST116") {
          return { ok: false, reason: "NO_CLOSED_CANDLE", candle: null };
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return { ok: false, reason: "NO_CLOSED_CANDLE", candle: null };
      }

      const row = data[0];
      const candle = {
        symbol: row.product_id,
        timeframe: row.timeframe,
        timestamp: new Date(row.time),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: row.volume ? parseFloat(row.volume) : 0,
      };

      return { ok: true, candle };
    } catch (error) {
      // Return DB_ERROR for actual errors (auth, connection, etc.)
      return { ok: false, reason: "DB_ERROR", candle: null };
    }
  }

  /**
   * Get the last N closed candles (sorted ascending by timestamp)
   * @param {Object} params - Query parameters
   * @param {string} params.symbol - Product ID (e.g., "BTC-USD")
   * @param {string} params.timeframe - Timeframe string (e.g., "1m", "5m", "1h", "1d")
   * @param {number} params.n - Number of candles to fetch
   * @param {Date} params.now - Current timestamp
   * @returns {Promise<Object>} Result object with candles array and gap information
   */
  async getLastNClosedCandles({ symbol, timeframe, n, now }) {
    try {
      if (!symbol || typeof symbol !== "string") {
        return {
          ok: false,
          reason: "INSUFFICIENT_DATA",
          candles: [],
          hasGap: false,
          gapCount: 0,
        };
      }

      if (!timeframe || typeof timeframe !== "string") {
        return {
          ok: false,
          reason: "INSUFFICIENT_DATA",
          candles: [],
          hasGap: false,
          gapCount: 0,
        };
      }

      if (typeof n !== "number" || n <= 0) {
        return {
          ok: false,
          reason: "INSUFFICIENT_DATA",
          candles: [],
          hasGap: false,
          gapCount: 0,
        };
      }

      if (!(now instanceof Date)) {
        return {
          ok: false,
          reason: "INSUFFICIENT_DATA",
          candles: [],
          hasGap: false,
          gapCount: 0,
        };
      }

      const timeframeMs = timeframeToMs(timeframe);
      const closedBefore = new Date(now.getTime() - timeframeMs);

      // Query for up to N candles before the closed threshold
      // Fetch a bit more to account for potential duplicates
      const { data, error } = await this.client
        .from("crypto_candles")
        .select("*")
        .eq("product_id", symbol)
        .eq("timeframe", timeframe)
        .lt("time", closedBefore.toISOString())
        .order("time", { ascending: false })
        .limit(n * 3); // Fetch extra to handle deduplication

      if (error) {
        // Handle empty result gracefully
        if (error.code === "PGRST116") {
          return {
            ok: false,
            reason: "INSUFFICIENT_DATA",
            candles: [],
            hasGap: false,
            gapCount: 0,
          };
        }
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          ok: false,
          reason: "INSUFFICIENT_DATA",
          candles: [],
          hasGap: false,
          gapCount: 0,
        };
      }

      // Convert rows to candle objects
      let candles = data.map((row) => ({
        symbol: row.product_id,
        timeframe: row.timeframe,
        timestamp: new Date(row.time),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: row.volume ? parseFloat(row.volume) : 0,
      }));

      // Deduplicate by timestamp (keep last occurrence)
      candles = dedupeCandlesByTimestamp(candles);

      // Sort ascending by timestamp
      candles = sortCandlesAsc(candles);

      // Take the last N candles (most recent)
      candles = candles.slice(-n);

      if (candles.length === 0) {
        return {
          ok: false,
          reason: "INSUFFICIENT_DATA",
          candles: [],
          hasGap: false,
          gapCount: 0,
        };
      }

      // Detect gaps
      const gapInfo = detectGaps(candles, timeframeMs);

      // Get earliest and latest timestamps
      const earliestTs = candles[0].timestamp;
      const latestTs = candles[candles.length - 1].timestamp;

      return {
        ok: true,
        candles,
        hasGap: gapInfo.hasGap,
        gapCount: gapInfo.gapCount,
        earliestTs,
        latestTs,
      };
    } catch (error) {
      // On any error, return empty result safely
      return {
        ok: false,
        reason: "INSUFFICIENT_DATA",
        candles: [],
        hasGap: false,
        gapCount: 0,
      };
    }
  }

  /**
   * Get the most recent timestamp present in the database (even if not closed)
   * @param {Object} params - Query parameters
   * @param {string} params.symbol - Product ID (e.g., "BTC-USD")
   * @param {string} params.timeframe - Timeframe string (e.g., "1m", "5m", "1h", "1d")
   * @returns {Promise<Date|null>} Most recent timestamp or null if none exists
   */
  async getLatestTimestamp({ symbol, timeframe }) {
    try {
      if (!symbol || typeof symbol !== "string") {
        return null;
      }

      if (!timeframe || typeof timeframe !== "string") {
        return null;
      }

      const { data, error } = await this.client
        .from("crypto_candles")
        .select("time")
        .eq("product_id", symbol)
        .eq("timeframe", timeframe)
        .order("time", { ascending: false })
        .limit(1);

      if (error) {
        // Handle empty result gracefully
        if (error.code === "PGRST116") {
          return null;
        }
        // On other errors, return null safely
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      return new Date(data[0].time);
    } catch (error) {
      // On any error, return null safely
      return null;
    }
  }
}

module.exports = { MarketDataRepository };

// Example usage:
/*
const { createClient } = require('@supabase/supabase-js');
const { MarketDataRepository } = require('./marketDataRepo');

// Initialize Supabase client (use your config)
const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create repository
const repo = new MarketDataRepository(supabaseClient);

// Example: Get latest closed candle
async function example1() {
  const result = await repo.getLatestClosedCandle({
    symbol: 'BTC-USD',
    timeframe: '5m',
    now: new Date(),
  });
  
  if (result.ok) {
    console.log('Latest closed candle:', result.candle);
  } else {
    console.log('No closed candle:', result.reason);
  }
}

// Example: Get last 50 closed candles
async function example2() {
  const result = await repo.getLastNClosedCandles({
    symbol: 'BTC-USD',
    timeframe: '5m',
    n: 50,
    now: new Date(),
  });
  
  if (result.ok) {
    console.log(`Fetched ${result.candles.length} candles`);
    console.log('Latest timestamp:', result.latestTs);
    console.log('Has gap:', result.hasGap);
    console.log('Gap count:', result.gapCount);
  } else {
    console.log('Insufficient data:', result.reason);
  }
}

// Example: Get latest timestamp (even if not closed)
async function example3() {
  const latestTs = await repo.getLatestTimestamp({
    symbol: 'BTC-USD',
    timeframe: '5m',
  });
  
  if (latestTs) {
    console.log('Latest timestamp:', latestTs);
  } else {
    console.log('No data found');
  }
}
*/

