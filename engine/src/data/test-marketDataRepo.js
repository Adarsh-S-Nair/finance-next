/**
 * Sanity test script for MarketDataRepository
 * 
 * Usage: node test-marketDataRepo.js
 * 
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
const { MarketDataRepository } = require("./marketDataRepo");

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

  // Test: Fetch last 50 closed 5m candles for BTC-USD
  const symbol = "BTC-USD";
  const timeframe = "5m";
  const n = 50;
  const now = new Date();

  console.log(`\n=== Testing MarketDataRepository ===`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Timeframe: ${timeframe}`);
  console.log(`Requested candles: ${n}`);
  console.log(`Current time: ${now.toISOString()}\n`);

  try {
    const result = await repo.getLastNClosedCandles({
      symbol,
      timeframe,
      n,
      now,
    });

    if (result.ok) {
      console.log(`✅ Success!`);
      console.log(`   Fetched ${result.candles.length} closed candles`);
      console.log(`   Latest timestamp: ${result.latestTs.toISOString()}`);
      console.log(`   Earliest timestamp: ${result.earliestTs.toISOString()}`);
      console.log(`   Has gap: ${result.hasGap}`);
      console.log(`   Gap count: ${result.gapCount}`);

      if (result.candles.length > 0) {
        const latest = result.candles[result.candles.length - 1];
        console.log(`\n   Latest candle:`);
        console.log(`     Time: ${latest.timestamp.toISOString()}`);
        console.log(`     OHLC: ${latest.open} / ${latest.high} / ${latest.low} / ${latest.close}`);
        console.log(`     Volume: ${latest.volume}`);
      }
    } else {
      console.log(`❌ No data available`);
      console.log(`   Reason: ${result.reason}`);
      console.log(`   This is expected if the database is empty or TTL has expired old data.`);
    }

    // Also test getLatestTimestamp
    console.log(`\n=== Testing getLatestTimestamp ===`);
    const latestTs = await repo.getLatestTimestamp({ symbol, timeframe });
    if (latestTs) {
      console.log(`✅ Latest timestamp (any): ${latestTs.toISOString()}`);
    } else {
      console.log(`❌ No timestamp found`);
    }

    // Test getLatestClosedCandle
    console.log(`\n=== Testing getLatestClosedCandle ===`);
    const closedResult = await repo.getLatestClosedCandle({ symbol, timeframe, now });
    if (closedResult.ok) {
      console.log(`✅ Latest closed candle:`);
      console.log(`   Time: ${closedResult.candle.timestamp.toISOString()}`);
      console.log(`   Close: ${closedResult.candle.close}`);
    } else {
      console.log(`❌ No closed candle: ${closedResult.reason}`);
    }
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

