/**
 * Test script for SignalEvaluator
 * 
 * Usage: node test-signalEvaluator.js
 * 
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
const { MarketDataRepository } = require("../data/marketDataRepo");
const { computeIndicators } = require("../indicators/indicators");
const { evaluateEntrySignal } = require("./signalEvaluator");
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

  // Test: Fetch candles and evaluate entry signal
  const symbol = "BTC-USD";
  const now = new Date();

  console.log(`\n=== Testing SignalEvaluator ===`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Current time: ${now.toISOString()}\n`);

  try {
    // Fetch latest closed 5m candle
    console.log("Fetching latest closed 5m candle...");
    const latest5mResult = await repo.getLatestClosedCandle({
      symbol,
      timeframe: "5m",
      now,
    });

    if (!latest5mResult.ok) {
      console.log(`❌ Failed to fetch latest 5m candle: ${latest5mResult.reason}`);
      process.exit(1);
    }

    const latest5mCandle = latest5mResult.candle;
    console.log(`✅ Latest 5m candle: ${latest5mCandle.timestamp.toISOString()}`);
    console.log(`   OHLC: ${latest5mCandle.open} / ${latest5mCandle.high} / ${latest5mCandle.low} / ${latest5mCandle.close}`);

    // Fetch latest closed 1h candle
    console.log("\nFetching latest closed 1h candle...");
    const latest1hResult = await repo.getLatestClosedCandle({
      symbol,
      timeframe: "1h",
      now,
    });

    if (!latest1hResult.ok) {
      console.log(`❌ Failed to fetch latest 1h candle: ${latest1hResult.reason}`);
      process.exit(1);
    }

    const latest1hCandle = latest1hResult.candle;
    console.log(`✅ Latest 1h candle: ${latest1hCandle.timestamp.toISOString()}`);
    console.log(`   OHLC: ${latest1hCandle.open} / ${latest1hCandle.high} / ${latest1hCandle.low} / ${latest1hCandle.close}`);

    // Fetch candles for indicators
    console.log("\nFetching candles for indicators...");
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

    // Compute indicators
    console.log("\n=== Computing Indicators ===");
    const indicatorResult = computeIndicators({
      candles5m: result5m.candles,
      candles1h: result1h.candles,
      config,
      hasGap5m: result5m.hasGap,
      hasGap1h: result1h.hasGap,
    });

    if (!indicatorResult.ok) {
      console.log(`❌ Failed to compute indicators: ${indicatorResult.reason}`);
      process.exit(1);
    }

    console.log(`✅ Indicators computed:`);
    console.log(`   EMA20 (5m): ${indicatorResult.values.ema20_5m.toFixed(4)}`);
    console.log(`   RSI14 (5m): ${indicatorResult.values.rsi14_5m.toFixed(2)}`);
    console.log(`   EMA200 (1h): ${indicatorResult.values.ema200_1h.toFixed(4)}`);
    console.log(`   EMA200 Slope: ${indicatorResult.values.ema200Slope.toFixed(4)}`);

    // Evaluate entry signal
    console.log("\n=== Evaluating Entry Signal ===");
    const signalResult = evaluateEntrySignal({
      latest5mCandle,
      latest1hCandle,
      indicators: indicatorResult,
      config,
    });

    console.log(`\n📊 Signal Evaluation Result:`);
    console.log(`   Action: ${signalResult.action}`);
    console.log(`   Reason: ${signalResult.reason}`);
    console.log(`\n   Debug Info:`);
    console.log(`     5m Close: ${signalResult.debug.close5m?.toFixed(2) || "N/A"}`);
    console.log(`     5m Open: ${signalResult.debug.open5m?.toFixed(2) || "N/A"}`);
    console.log(`     EMA20 (5m): ${signalResult.debug.ema20_5m?.toFixed(4) || "N/A"}`);
    console.log(`     RSI14 (5m): ${signalResult.debug.rsi14_5m?.toFixed(2) || "N/A"}`);
    console.log(`     1h Close: ${signalResult.debug.close1h?.toFixed(2) || "N/A"}`);
    console.log(`     EMA200 (1h): ${signalResult.debug.ema200_1h?.toFixed(4) || "N/A"}`);
    console.log(`     EMA200 Slope: ${signalResult.debug.ema200Slope?.toFixed(4) || "N/A"}`);
    if (signalResult.debug.pullbackDistancePct !== undefined) {
      console.log(`     Pullback Distance: ${(signalResult.debug.pullbackDistancePct * 100).toFixed(3)}%`);
      console.log(`     Pullback Limit: ${(config.strategy.pullbackPct * 100).toFixed(3)}%`);
    }

    // Show strategy config for reference
    console.log(`\n   Strategy Config:`);
    console.log(`     Pullback Pct: ${(config.strategy.pullbackPct * 100).toFixed(3)}%`);
    console.log(`     RSI Range: [${config.strategy.rsiMin}, ${config.strategy.rsiMax}]`);

    // Test edge cases
    console.log("\n=== Testing Edge Cases ===");
    
    // Test with missing inputs
    const missingInputResult = evaluateEntrySignal({
      latest5mCandle: null,
      latest1hCandle,
      indicators: indicatorResult,
      config,
    });
    console.log(`Missing 5m candle: ${missingInputResult.action} - ${missingInputResult.reason}`);

    // Test with invalid indicators
    const invalidIndicatorsResult = evaluateEntrySignal({
      latest5mCandle,
      latest1hCandle,
      indicators: { ok: false },
      config,
    });
    console.log(`Invalid indicators: ${invalidIndicatorsResult.action} - ${invalidIndicatorsResult.reason}`);
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






