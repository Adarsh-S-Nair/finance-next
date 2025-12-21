/**
 * Standalone script to sync NASDAQ-100 constituents
 * 
 * Usage:
 *   node scripts/sync-nasdaq100.js
 * 
 * Or with npm:
 *   npm run sync:nasdaq100
 * 
 * Scrapes the official NASDAQ website - no API keys required!
 */

// Note: This script uses dynamic import since marketData.js uses ES modules
// but this script file uses CommonJS (matching other scripts in this directory)

async function main() {
  try {
    // Dynamic import for ES module
    const { syncNasdaq100Constituents } = await import('../src/lib/marketData.js');
    
    console.log('\n========================================');
    console.log('🔄 SYNCING NASDAQ-100 CONSTITUENTS');
    console.log('========================================\n');

    const result = await syncNasdaq100Constituents();

    console.log('\n✅ SUCCESS');
    console.log(`📊 Tickers synced: ${result.count}`);
    console.log(`📅 Last updated: ${result.lastUpdated}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR');
    console.error(error.message);
    console.error('\n💡 This script scrapes the official NASDAQ website');
    console.error('   If it fails, the page structure may have changed');
    console.error('========================================\n');
    process.exit(1);
  }
}

main();

