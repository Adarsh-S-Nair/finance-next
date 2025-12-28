/**
 * Test script for Engine Tick with real DB state
 * 
 * Usage: PORTFOLIO_ID=<uuid> node test-engineTick-dbstate.js
 * 
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - PORTFOLIO_ID (portfolio UUID to test)
 */

const { createClient } = require("@supabase/supabase-js");
const { runEngineTick } = require("./engineTick");

async function runTest() {
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const portfolioId = process.env.PORTFOLIO_ID;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    process.exit(1);
  }

  if (!portfolioId) {
    console.error("Error: PORTFOLIO_ID must be set");
    console.error("Usage: PORTFOLIO_ID=<uuid> node test-engineTick-dbstate.js");
    process.exit(1);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Test symbol (default to BTC-USD, can be overridden)
  const symbol = process.env.SYMBOL || "BTC-USD";
  const now = new Date();

  console.log(`\n=== Testing Engine Tick with Real DB State ===`);
  console.log(`Portfolio ID: ${portfolioId}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Time: ${now.toISOString()}\n`);

  try {
    const result = await runEngineTick({
      supabaseClient,
      symbol,
      now,
      portfolioId,
    });

    // Print key metrics
    console.log(`\n📊 Portfolio State:`);
    if (result.risk.details) {
      console.log(`   Open Positions: ${result.risk.details.openPositionsCount || 0}`);
      console.log(
        `   Today Net Cashflow: $${(result.risk.details.todayNetCashflow || 0).toFixed(2)}`
      );
      console.log(
        `   Today Cash Spent Proxy: $${(result.risk.details.todayCashSpentProxy || 0).toFixed(2)}`
      );
      console.log(
        `   Last Stop-Out: ${result.risk.details.lastStopOutAt || "None"}`
      );
    }

    // Print risk status
    const riskStatus = result.risk.allowed ? "ALLOWED" : `BLOCKED(${result.risk.reason || "unknown"})`;
    console.log(`\n🛡️  Risk Status: ${riskStatus}`);

    // Print signal
    console.log(`\n📈 Signal:`);
    console.log(`   Action: ${result.signal.action}`);
    console.log(`   Reason: ${result.signal.reason}`);

    // Print concise single-line output
    const latest5m = result.marketData.latest5mTs
      ? new Date(result.marketData.latest5mTs).toISOString().replace("T", " ").substring(0, 19)
      : "N/A";
    const latest1h = result.marketData.latest1hTs
      ? new Date(result.marketData.latest1hTs).toISOString().replace("T", " ").substring(0, 19)
      : "N/A";

    console.log(
      `\n[${symbol}] risk=${riskStatus} signal=${result.signal.action} reason=${result.signal.reason} latest5m=${latest5m} latest1h=${latest1h}`
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

