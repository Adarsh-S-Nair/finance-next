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
 * But needs Supabase credentials for database updates.
 */

const fs = require('fs');
const path = require('path');

// Load .env or .env.local file if it exists
function loadEnvFile() {
  const rootDir = path.join(__dirname, '..');
  const envFiles = ['.env.local', '.env']; // Check .env.local first, then .env
  
  let loaded = false;
  
  for (const envFile of envFiles) {
    const envPath = path.join(rootDir, envFile);
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // Parse KEY=VALUE format
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Only set if not already in environment (env vars take precedence)
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      
      console.log(`✅ Loaded environment variables from ${envFile}`);
      loaded = true;
      break; // Stop after loading first file found
    }
  }
  
  if (!loaded) {
    console.warn('⚠️  No .env.local or .env file found, using system environment variables');
  }
}

// Load env vars before importing modules
loadEnvFile();

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

