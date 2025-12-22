/**
 * Standalone script to populate tickers table with NASDAQ-100 data
 * 
 * This script:
 * 1. Scrapes NASDAQ-100 constituents from the official website
 * 2. Fetches stock data (domain, sector) from Finnhub
 * 3. Upserts tickers into the database with logos from logo.dev
 * 
 * Usage:
 *   node scripts/populate-tickers.js
 * 
 * Or with npm (if added to package.json):
 *   npm run populate:tickers
 * 
 * Requires:
 * - Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * - FINNHUB_API_KEY for fetching domain/sector data
 * - LOGO_DEV_PUBLIC_KEY for generating logo URLs
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

async function main() {
  try {
    // Dynamic imports for ES modules
    const { createClient } = await import('@supabase/supabase-js');
    const { scrapeNasdaq100Constituents, fetchBulkTickerDetails } = await import('../src/lib/marketData.js');
    
    // Check required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const finnhubApiKey = process.env.FINNHUB_API_KEY;
    const logoDevPublicKey = process.env.LOGO_DEV_PUBLIC_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    
    if (!finnhubApiKey) {
      throw new Error('Missing required environment variable: FINNHUB_API_KEY (required for fetching ticker details)');
    }
    
    if (!logoDevPublicKey) {
      throw new Error('Missing required environment variable: LOGO_DEV_PUBLIC_KEY (required for generating logo URLs)');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('\n========================================');
    console.log('🚀 POPULATING TICKERS TABLE');
    console.log('========================================');
    console.log('This will:');
    console.log('  1. Scrape NASDAQ-100 constituents');
    console.log('  2. Fetch name/sector/domain from Finnhub');
    console.log('  3. Upsert tickers with logo.dev logos');
    console.log('========================================\n');
    
    // Step 1: Scrape NASDAQ-100 constituents
    console.log('📊 STEP 1: SCRAPING NASDAQ-100 CONSTITUENTS');
    console.log('========================================');
    const constituents = await scrapeNasdaq100Constituents();
    console.log(`✅ Scraped ${constituents.length} NASDAQ-100 constituents\n`);
    
    // Step 2: Check existing tickers in database
    console.log('💾 STEP 2: CHECKING EXISTING TICKERS IN DATABASE');
    console.log('========================================');
    const tickerSymbols = constituents.map(c => c.ticker);
    const { data: existingTickers, error: fetchError } = await supabase
      .from('tickers')
      .select('symbol, logo, name, sector')
      .in('symbol', tickerSymbols);
    
    if (fetchError) {
      console.warn('⚠️  Could not fetch existing tickers:', fetchError.message);
    }
    
    // Create a map of existing tickers by symbol for quick lookup
    const existingTickersMap = new Map();
    if (existingTickers) {
      existingTickers.forEach(t => {
        existingTickersMap.set(t.symbol, t);
      });
    }
    
    // Identify tickers that need to be fetched (don't have logo or missing data)
    const tickersToFetch = constituents.filter(c => {
      const existing = existingTickersMap.get(c.ticker);
      // Fetch if: no existing record, or no logo, or missing name/sector
      return !existing || !existing.logo || !existing.name || !existing.sector;
    });
    
    const tickersToSkip = constituents.length - tickersToFetch.length;
    
    console.log(`   Found ${existingTickers?.length || 0} existing tickers in database`);
    console.log(`   ${tickersToSkip} tickers already have complete data (skipping)`);
    console.log(`   ${tickersToFetch.length} tickers need data from Finnhub\n`);
    
    // Step 3: Fetch ticker details from Finnhub (only for tickers that need it)
    let tickerDetails = [];
    if (tickersToFetch.length > 0) {
      console.log('📊 STEP 3: FETCHING TICKER DETAILS FROM FINNHUB');
      console.log('========================================');
      const tickersToFetchList = tickersToFetch.map(c => c.ticker);
      // Process all tickers sequentially with delays to avoid rate limiting
      // Using 1000ms delay between requests (60 requests/minute = 1 per second)
      const fetchedDetails = await fetchBulkTickerDetails(tickersToFetchList, 1000);
      tickerDetails = fetchedDetails;
      
      // Separate successful fetches from errors
      const successfulData = tickerDetails.filter(d => !d.error);
      const failedTickers = tickerDetails.filter(d => d.error);
      
      if (failedTickers.length > 0) {
        console.log(`\n⚠️  Failed to fetch data for ${failedTickers.length} tickers:`);
        failedTickers.forEach(d => {
          console.log(`  - ${d.ticker}: ${d.error}`);
        });
      }
      
      console.log(`\n✅ Successfully fetched data for ${successfulData.length} tickers\n`);
    } else {
      console.log('📊 STEP 3: SKIPPING FINNHUB FETCH');
      console.log('========================================');
      console.log('All tickers already have complete data in database!\n');
    }
    
    // Step 4: Prepare ticker upserts
    console.log('💾 STEP 4: PREPARING TICKER UPSERTS');
    console.log('========================================');
    
    // Create a map of fetched ticker details by ticker for quick lookup
    const tickerDetailsMap = new Map();
    tickerDetails.forEach(detail => {
      if (!detail.error) {
        tickerDetailsMap.set(detail.ticker, detail);
      }
    });
    
    // Prepare ticker upserts with data from scraping and Finnhub
    const tickerInserts = constituents.map(c => {
      const existingTicker = existingTickersMap.get(c.ticker);
      const tickerDetail = tickerDetailsMap.get(c.ticker);
      
      // Use existing data if available, otherwise use fetched data, otherwise fall back to scraped name
      const name = existingTicker?.name || tickerDetail?.name || c.name || null;
      const sector = existingTicker?.sector || tickerDetail?.sector || null;
      const domain = tickerDetail?.domain || null;
      
      // Preserve existing logo if it exists, otherwise generate from domain
      let logo = null;
      if (existingTicker?.logo && existingTicker.logo.trim() !== '') {
        // Preserve existing logo
        logo = existingTicker.logo;
      } else if (domain && logoDevPublicKey) {
        // Generate logo URL from domain using logo.dev
        logo = `https://img.logo.dev/${domain}?token=${logoDevPublicKey}`;
      }
      
      return {
        symbol: c.ticker,
        name: name,
        sector: sector,
        logo: logo,
      };
    });
    
    // Step 5: Upsert tickers into the database
    console.log('💾 STEP 5: UPSERTING TICKERS INTO DATABASE');
    console.log('========================================');
    
    const { data: insertedTickers, error: tickerError } = await supabase
      .from('tickers')
      .upsert(tickerInserts, {
        onConflict: 'symbol',
        ignoreDuplicates: false, // Update if exists
      })
      .select();
    
    if (tickerError) {
      throw new Error(`Failed to upsert tickers: ${tickerError.message}`);
    }
    
    const withName = tickerInserts.filter(t => t.name).length;
    const withSector = tickerInserts.filter(t => t.sector).length;
    const withLogo = tickerInserts.filter(t => t.logo).length;
    const withDomain = tickerInserts.filter(t => {
      const tickerDetail = tickerDetailsMap.get(t.symbol);
      return tickerDetail?.domain;
    }).length;
    
    console.log(`✅ Successfully upserted ${insertedTickers?.length || tickerInserts.length} tickers`);
    console.log(`   - ${withName} with company names`);
    console.log(`   - ${withSector} with sector information`);
    console.log(`   - ${withDomain} with domain information`);
    console.log(`   - ${withLogo} with logo URLs`);
    console.log('========================================\n');
    
    console.log('✅ SUCCESS!');
    console.log('Tickers table has been populated with NASDAQ-100 data.');
    console.log('You can now view logos in the holdings table.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('\n========================================\n');
    process.exit(1);
  }
}

main();

