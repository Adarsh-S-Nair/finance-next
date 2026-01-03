/**
 * Test script for Engine Tick Orchestrator
 * 
 * Usage: node test-engineTick.js
 * 
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
const { runEngineTick } = require("./engineTick");

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

  // Test portfolio
  const portfolio = {
    id: "paper",
    equity: 100000,
    cash_balance: 100000,
  };

  const symbol = "BTC-USD";
  const now = new Date();

  console.log(`\n=== Testing Engine Tick ===`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Portfolio: ${portfolio.id} (equity: $${portfolio.equity.toLocaleString()})`);
  console.log(`Time: ${now.toISOString()}\n`);

  try {
    const result = await runEngineTick({
      supabaseClient,
      symbol,
      now,
      portfolio,
    });

    // Print concise single-line output
    const riskStatus = result.risk.allowed ? "ALLOWED" : `BLOCKED(${result.risk.reason || "unknown"})`;
    const signalAction = result.signal.action;
    const signalReason = result.signal.reason;
    const latest5m = result.marketData.latest5mTs
      ? new Date(result.marketData.latest5mTs).toISOString().replace("T", " ").substring(0, 19)
      : "N/A";
    const latest1h = result.marketData.latest1hTs
      ? new Date(result.marketData.latest1hTs).toISOString().replace("T", " ").substring(0, 19)
      : "N/A";

    console.log(
      `[${symbol}] risk=${riskStatus} signal=${signalAction} reason=${signalReason} latest5m=${latest5m} latest1h=${latest1h}`
    );

    // Print detailed output if tick failed
    if (!result.ok) {
      console.log(`\n❌ Tick failed:`);
      result.notes.forEach((note) => console.log(`   - ${note}`));
    } else {
      console.log(`\n✅ Tick completed successfully`);

      // Print additional details
      if (result.indicators.ok) {
        const ind = result.indicators.values;
        console.log(`\n   Indicators:`);
        console.log(`     EMA20 (5m): ${ind.ema20_5m?.toFixed(4) || "N/A"}`);
        console.log(`     RSI14 (5m): ${ind.rsi14_5m?.toFixed(2) || "N/A"}`);
        console.log(`     EMA200 (1h): ${ind.ema200_1h?.toFixed(4) || "N/A"}`);
        console.log(`     EMA200 Slope: ${ind.ema200Slope?.toFixed(4) || "N/A"}`);
      } else {
        console.log(`\n   Indicators: ${result.indicators.reason || "FAILED"}`);
      }

      if (result.signal.debug && Object.keys(result.signal.debug).length > 0) {
        console.log(`\n   Signal Debug:`);
        if (result.signal.debug.pullbackDistancePct !== undefined) {
          console.log(
            `     Pullback: ${(result.signal.debug.pullbackDistancePct * 100).toFixed(3)}%`
          );
        }
        if (result.signal.debug.rsi14_5m !== undefined) {
          console.log(`     RSI: ${result.signal.debug.rsi14_5m.toFixed(2)}`);
        }
      }

      if (result.marketData.hasGap5m || result.marketData.hasGap1h) {
        console.log(`\n   ⚠️  Data gaps detected:`);
        if (result.marketData.hasGap5m) console.log(`     - 5m candles have gaps`);
        if (result.marketData.hasGap1h) console.log(`     - 1h candles have gaps`);
      }
    }

    // Print all notes if verbose
    if (process.env.VERBOSE === "1" && result.notes.length > 0) {
      console.log(`\n   Notes:`);
      result.notes.forEach((note) => console.log(`     - ${note}`));
    }
  } catch (error) {
    console.error(`\n❌ Test failed:`, error);
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






