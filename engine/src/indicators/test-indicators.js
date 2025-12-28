/**
 * Test script for IndicatorService
 * 
 * Usage: node test-indicators.js
 * 
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
const { MarketDataRepository } = require("../data/marketDataRepo");
const { computeIndicators } = require("./indicators");
const { getDefaultEngineConfig } = require("../config/engineConfig");

async function runTest() {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    process.exit(1);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Create repository
  const repo = new MarketDataRepository(supabaseClient);

  // Get config
  const config = getDefaultEngineConfig();

  // Test: Fetch candles and compute indicators
  const symbol = "BTC-USD";
  const now = new Date();

  console.log(`\n=== Testing IndicatorService ===`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Current time: ${now.toISOString()}\n`);

  try {
    // Fetch 5m candles: need at least 20 + rsiPeriod (14) + buffer = 100
    console.log("Fetching 5m candles (need at least 20 + 14 + buffer = 100)...");
    const result5m = await repo.getLastNClosedCandles({
      symbol,
      timeframe: "5m",
      n: 100,
      now,
    });

    if (!result5m.ok) {
      console.log(`❌ Failed to fetch 5m candles: ${result5m.reason}`);
      process.exit(1);
    }

    console.log(`✅ Fetched ${result5m.candles.length} closed 5m candles`);
    console.log(`   Latest: ${result5m.latestTs.toISOString()}`);
    console.log(`   Has gap: ${result5m.hasGap}`);

    // Fetch 1h candles: need at least 200 + buffer = 260
    console.log("\nFetching 1h candles (need at least 200 + buffer = 260)...");
    const result1h = await repo.getLastNClosedCandles({
      symbol,
      timeframe: "1h",
      n: 260,
      now,
    });

    if (!result1h.ok) {
      console.log(`❌ Failed to fetch 1h candles: ${result1h.reason}`);
      process.exit(1);
    }

    console.log(`✅ Fetched ${result1h.candles.length} closed 1h candles`);
    console.log(`   Latest: ${result1h.latestTs.toISOString()}`);
    console.log(`   Has gap: ${result1h.hasGap}`);

    // Compute indicators
    console.log("\n=== Computing Indicators ===");
    const indicatorResult = computeIndicators({
      candles5m: result5m.candles,
      candles1h: result1h.candles,
      config,
      hasGap5m: result5m.hasGap,
      hasGap1h: result1h.hasGap,
    });

    if (indicatorResult.ok) {
      console.log(`✅ Indicators computed successfully:`);
      console.log(`   EMA20 (5m): ${indicatorResult.values.ema20_5m.toFixed(4)}`);
      console.log(`   RSI14 (5m): ${indicatorResult.values.rsi14_5m.toFixed(2)}`);
      console.log(`   EMA200 (1h): ${indicatorResult.values.ema200_1h.toFixed(4)}`);
      console.log(`   EMA200 Slope: ${indicatorResult.values.ema200Slope.toFixed(4)}`);
    } else {
      console.log(`❌ Failed to compute indicators: ${indicatorResult.reason}`);
      process.exit(1);
    }

    // Test individual indicator functions
    console.log("\n=== Testing Individual Indicators ===");
    const { ema, rsi } = require("./indicators");
    const closes5m = result5m.candles.map((c) => c.close);

    const ema20 = ema(closes5m, 20);
    console.log(`EMA(20) test: ${ema20 !== null ? ema20.toFixed(4) : "null"}`);

    const rsi14 = rsi(closes5m, 14);
    console.log(`RSI(14) test: ${rsi14 !== null ? rsi14.toFixed(2) : "null"}`);

    // Test edge cases
    console.log("\n=== Testing Edge Cases ===");
    const emaInvalid = ema([], 20);
    console.log(`EMA with empty array: ${emaInvalid === null ? "null (correct)" : "error"}`);

    const rsiInvalid = rsi([1, 2, 3], 14);
    console.log(`RSI with insufficient data: ${rsiInvalid === null ? "null (correct)" : "error"}`);
  } catch (error) {
    console.error(`\n❌ Error during test:`, error);
    process.exit(1);
  }
}

// Run the test
runTest()
  .then(() => {
    console.log(`\n=== Test completed ===\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Test failed:`, error);
    process.exit(1);
  });


