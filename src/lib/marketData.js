/**
 * Market Data Utilities
 * Functions for fetching market data, index constituents, etc.
 */

import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

// Lazy import supabaseAdmin to avoid build-time errors
let supabaseAdmin = null;
async function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const { supabaseAdmin: admin } = await import('./supabaseAdmin.js');
    supabaseAdmin = admin;
  }
  return supabaseAdmin;
}

/**
 * Scrape NASDAQ-100 constituents from official NASDAQ website
 * Extracts ticker, name, and any other available data from the table
 * 
 * @returns {Promise<Array<{ticker: string, name?: string}>>} Array of constituent objects
 */
export async function scrapeNasdaq100Constituents() {
  const url = 'https://www.nasdaq.com/solutions/global-indexes/nasdaq-100/companies';
  
  console.log('📡 Scraping NASDAQ-100 constituents from official NASDAQ website...');
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NASDAQ page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract data from the table structure
    // Structure: <table> -> <tbody> -> <tr> -> <td> columns (ticker, name, etc.)
    const constituents = [];
    
    // Find the table (there should be only one)
    const table = $('table').first();
    
    if (table.length === 0) {
      throw new Error('No table found on the page');
    }
    
    // Extract data from each row
    // Structure: <tr> -> <td>[0] = ticker, <td>[1] = company name
    table.find('tbody tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return; // Skip header rows
      
      const ticker = $(cells[0]).text().trim().toUpperCase();
      const name = cells.length > 1 ? $(cells[1]).text().trim() : undefined;
      
      // Validate it looks like a ticker (1-5 uppercase letters)
      if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
        constituents.push({
          ticker,
          name: name || undefined,
        });
      }
    });
    
    // If tbody approach didn't work, try direct tr -> td
    if (constituents.length === 0) {
      table.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length === 0) return; // Skip header rows
        
        const ticker = $(cells[0]).text().trim().toUpperCase();
        const name = cells.length > 1 ? $(cells[1]).text().trim() : undefined;
        
        if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
          constituents.push({
            ticker,
            name: name || undefined,
          });
        }
      });
    }
    
    // Remove duplicates by ticker (keep first occurrence)
    const uniqueConstituents = [];
    const seenTickers = new Set();
    for (const constituent of constituents) {
      if (!seenTickers.has(constituent.ticker)) {
        seenTickers.add(constituent.ticker);
        uniqueConstituents.push(constituent);
      }
    }
    
    // Sort by ticker
    uniqueConstituents.sort((a, b) => a.ticker.localeCompare(b.ticker));
    
    if (uniqueConstituents.length < 50) {
      console.warn('⚠️  Only found', uniqueConstituents.length, 'constituents. The page structure may have changed.');
      console.log('📋 Found tickers so far:', uniqueConstituents.slice(0, 10).map(c => c.ticker).join(', '), '...');
      
      // Log table structure for debugging
      const tableCount = $('table').length;
      const tbodyCount = $('table tbody').length;
      const trCount = $('table tbody tr').length;
      console.log(`🔍 Debug: Found ${tableCount} table(s), ${tbodyCount} tbody(s), ${trCount} tr(s) in tbody`);
    }
    
    console.log(`✅ Scraped ${uniqueConstituents.length} NASDAQ-100 constituents from official website`);
    return uniqueConstituents;
    
  } catch (error) {
    console.error('❌ Error scraping NASDAQ-100 constituents:', error);
    throw error;
  }
}

/**
 * Get NASDAQ-100 constituents (convenience wrapper)
 * Uses web scraping from official NASDAQ website
 * 
 * @returns {Promise<Array<{ticker: string, name?: string}>>} Array of constituent objects
 */
export async function fetchNasdaq100Constituents() {
  return scrapeNasdaq100Constituents();
}

/**
 * Load NASDAQ-100 constituents (tries DB first, falls back to file)
 * 
 * @returns {Promise<Array<string>>} Array of ticker symbols
 */
export async function loadNasdaq100Constituents() {
  // Try database first
  try {
    const tickers = await loadNasdaq100ConstituentsFromDB();
    if (tickers && tickers.length > 0) {
      return tickers;
    }
  } catch (error) {
    console.warn('⚠️  Could not load from database, falling back to file:', error.message);
  }
  
  // Fallback to local file
  const filePath = path.join(DATA_DIR, 'nasdaq100-constituents.json');
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.tickers || [];
  } catch (error) {
    console.error('Error loading NASDAQ-100 constituents from file:', error);
    return [];
  }
}

/**
 * Save NASDAQ-100 constituents to local file
 * 
 * @param {Array<string>} tickers - Array of ticker symbols
 */
export function saveNasdaq100Constituents(tickers) {
  const filePath = path.join(DATA_DIR, 'nasdaq100-constituents.json');
  
  const data = {
    lastUpdated: new Date().toISOString(),
    tickers: tickers.sort(), // Sort alphabetically for consistency
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Saved ${tickers.length} NASDAQ-100 constituents to ${filePath}`);
}

/**
 * Save NASDAQ-100 constituents to Supabase
 * Uses the sync_nasdaq100_constituents function to update the database
 * Also updates name and other metadata if available
 * 
 * @param {Array<{ticker: string, name?: string}>} constituents - Array of constituent objects
 */
export async function saveNasdaq100ConstituentsToDB(constituents) {
  const admin = await getSupabaseAdmin();
  
  if (!admin) {
    throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  // Extract just tickers for the sync function
  const tickers = constituents.map(c => c.ticker.toUpperCase());

  // Call the database function to sync constituents (handles history)
  const { error: syncError } = await admin.rpc('sync_nasdaq100_constituents', {
    tickers,
  });

  if (syncError) {
    throw new Error(`Failed to sync constituents: ${syncError.message}`);
  }

  // Update metadata (name) for each constituent
  // Do this in parallel for efficiency
  const updatesWithNames = constituents.filter(c => c.name);
  
  if (updatesWithNames.length > 0) {
    const updatePromises = updatesWithNames.map(async (constituent) => {
      const { error: updateError } = await admin
        .from('nasdaq100_constituents')
        .update({ name: constituent.name })
        .eq('ticker', constituent.ticker.toUpperCase());
      
      if (updateError) {
        console.warn(`⚠️  Failed to update name for ${constituent.ticker}:`, updateError.message);
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`✅ Updated names for ${updatesWithNames.length} constituents`);
  }

  console.log(`✅ Synced ${constituents.length} NASDAQ-100 constituents to database`);
}

/**
 * Load NASDAQ-100 constituents from Supabase
 * 
 * @returns {Promise<Array<string>>} Array of active ticker symbols
 */
export async function loadNasdaq100ConstituentsFromDB() {
  const admin = await getSupabaseAdmin();
  
  if (!admin) {
    throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { data, error } = await admin
    .from('nasdaq100_constituents')
    .select('ticker')
    .is('removed_at', null) // Only active constituents
    .order('ticker');

  if (error) {
    throw new Error(`Failed to load from database: ${error.message}`);
  }

  return data.map(row => row.ticker);
}

/**
 * Sync NASDAQ-100 constituents (fetch, save to DB with history, and log)
 * 
 * @returns {Promise<{tickers: Array<string>, count: number, lastUpdated: string}>}
 */
export async function syncNasdaq100Constituents() {
  console.log('🔄 Fetching NASDAQ-100 constituents...');
  
  const constituents = await fetchNasdaq100Constituents();
  
  if (!constituents || constituents.length === 0) {
    throw new Error('No constituents returned from scraper');
  }
  
  if (constituents.length < 90) {
    console.warn(`⚠️  Warning: Expected ~100 constituents, got ${constituents.length}`);
  }
  
  // Extract tickers for logging
  const tickers = constituents.map(c => c.ticker);
  
  // Log the results
  console.log('\n📊 SCRAPED NASDAQ-100 CONSTITUENTS:');
  console.log('========================================');
  console.log(`Total constituents found: ${constituents.length}`);
  console.log('\nConstituents:');
  constituents.forEach((constituent, index) => {
    const nameStr = constituent.name ? ` - ${constituent.name}` : '';
    const line = `${(index + 1).toString().padStart(3, ' ')}. ${constituent.ticker}${nameStr}`;
    console.log(line);
  });
  console.log('========================================\n');
  
  // Save to Supabase (primary storage with history)
  try {
    await saveNasdaq100ConstituentsToDB(constituents);
  } catch (dbError) {
    console.error('❌ Failed to save to database:', dbError.message);
    console.log('💡 Falling back to local file storage...');
    // Fallback to local file if DB fails
    saveNasdaq100Constituents(tickers);
    // Don't throw - allow it to continue with file backup
  }
  
  // Also save to local file as backup (always)
  saveNasdaq100Constituents(tickers);
  
  return {
    tickers,
    count: constituents.length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Fetch stock data for a single ticker using Yahoo Finance's free public API
 * 
 * Uses:
 * - Yahoo Finance v8 API (query1.finance.yahoo.com/v8/finance/chart/) for price and historical data
 * - Yahoo Finance v10 API (query2.finance.yahoo.com/v10/finance/quoteSummary/) for sector/company info
 * 
 * Returns: current price, returns (1d, 5d, 20d), distance from 50-day MA, avg dollar volume, sector
 * 
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Stock data object
 */
export async function fetchStockData(ticker) {
  try {
    // Yahoo Finance v8 API for price and historical data
    // Get 60 days of data to calculate 50-day MA
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (60 * 24 * 60 * 60); // 60 days ago
    
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${startDate}&period2=${endDate}`;
    
    // Yahoo Finance v10 API for quote summary (sector, etc.)
    const quoteUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,summaryProfile`;
    
    const [chartResponse, quoteResponse] = await Promise.all([
      fetch(chartUrl),
      fetch(quoteUrl),
    ]);
    
    if (!chartResponse.ok) {
      throw new Error(`Chart API error: ${chartResponse.status}`);
    }
    
    const chartData = await chartResponse.json();
    const quoteData = quoteResponse.ok ? await quoteResponse.json().catch(() => null) : null;
    
    const result = chartData.chart?.result?.[0];
    if (!result) {
      throw new Error('No data in chart response');
    }
    
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];
    
    // Filter out null values and align arrays
    const validData = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        validData.push({
          timestamp: timestamps[i],
          close: closes[i],
          volume: volumes[i] || 0,
          high: highs[i] || closes[i],
          low: lows[i] || closes[i],
        });
      }
    }
    
    if (validData.length === 0) {
      throw new Error('No valid price data');
    }
    
    // Current price (most recent close)
    const currentPrice = validData[validData.length - 1].close;
    
    // Calculate returns
    const return1d = validData.length >= 2 
      ? ((currentPrice - validData[validData.length - 2].close) / validData[validData.length - 2].close) * 100 
      : null;
    
    const return5d = validData.length >= 6
      ? ((currentPrice - validData[validData.length - 6].close) / validData[validData.length - 6].close) * 100
      : null;
    
    const return20d = validData.length >= 21
      ? ((currentPrice - validData[validData.length - 21].close) / validData[validData.length - 21].close) * 100
      : null;
    
    // Calculate 50-day MA (use available data, minimum 20 days)
    const maPeriod = Math.min(50, validData.length);
    let sma50 = null;
    let distanceFromSMA50 = null;
    
    if (validData.length >= 20) {
      const pricesForMA = validData.slice(-maPeriod).map(d => d.close);
      sma50 = pricesForMA.reduce((sum, price) => sum + price, 0) / pricesForMA.length;
      distanceFromSMA50 = ((currentPrice - sma50) / sma50) * 100;
    }
    
    // Calculate average dollar volume over last 20 days
    let avgDollarVolume = null;
    if (validData.length >= 20) {
      const recentData = validData.slice(-20);
      const dollarVolumes = recentData.map(d => d.close * (d.volume || 0));
      const totalDollarVolume = dollarVolumes.reduce((sum, dv) => sum + dv, 0);
      avgDollarVolume = totalDollarVolume / recentData.length;
    }
    
    // Extract sector and website from quote summary
    const quoteResult = quoteData?.quoteSummary?.result?.[0];
    let sector = null;
    let website = null;
    
    // Debug: Log what we're getting from Yahoo Finance
    if (quoteResult) {
      // Try assetProfile first
      if (quoteResult.assetProfile) {
        sector = quoteResult.assetProfile.sector || null;
        website = quoteResult.assetProfile.website || null;
        // Debug logging
        if (!website && !sector) {
          console.log(`  [YF Debug ${ticker}] assetProfile exists but no website/sector. Keys:`, Object.keys(quoteResult.assetProfile || {}));
        }
      }
      
      // Fallback to summaryProfile
      if (!sector && quoteResult.summaryProfile) {
        sector = quoteResult.summaryProfile.sector || null;
      }
      if (!website && quoteResult.summaryProfile) {
        website = quoteResult.summaryProfile.website || null;
        // Debug logging
        if (!website && !sector) {
          console.log(`  [YF Debug ${ticker}] summaryProfile exists but no website/sector. Keys:`, Object.keys(quoteResult.summaryProfile || {}));
        }
      }
      
      // If we still don't have data, log the full structure for debugging
      if (!website && !sector && quoteResult) {
        console.log(`  [YF Debug ${ticker}] quoteResult keys:`, Object.keys(quoteResult));
      }
    } else {
      console.log(`  [YF Debug ${ticker}] No quoteResult from Yahoo Finance API`);
    }
    
    // Try Finnhub API as fallback if Yahoo Finance didn't provide website/domain
    let domain = null;
    if (website) {
      try {
        const url = new URL(website.startsWith('http') ? website : `https://${website}`);
        domain = url.hostname.replace('www.', ''); // Remove www. prefix
      } catch (e) {
        // If URL parsing fails, try to extract domain manually
        const match = website.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
        if (match) {
          domain = match[1];
        }
      }
    }
    
    // Fallback to Finnhub API if we don't have domain/sector from Yahoo Finance
    if (!domain || !sector) {
      try {
        const finnhubApiKey = process.env.FINNHUB_API_KEY;
        if (finnhubApiKey) {
          console.log(`  [Finnhub ${ticker}] Using Finnhub API fallback (missing: ${!domain ? 'domain' : ''}${!domain && !sector ? ', ' : ''}${!sector ? 'sector' : ''})`);
          const finnhubUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubApiKey}`;
          const finnhubResponse = await fetch(finnhubUrl);
          
          if (finnhubResponse.ok) {
            const finnhubData = await finnhubResponse.json();
            
            // Get website/domain from Finnhub if not from Yahoo Finance
            if (!domain && finnhubData) {
              const finnhubWeb = finnhubData.weburl || finnhubData.url || null;
              if (finnhubWeb) {
                try {
                  const url = new URL(finnhubWeb.startsWith('http') ? finnhubWeb : `https://${finnhubWeb}`);
                  domain = url.hostname.replace('www.', '');
                  console.log(`  [Finnhub ${ticker}] ✓ Got domain from Finnhub: ${domain}`);
                } catch (e) {
                  const match = finnhubWeb.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
                  if (match) {
                    domain = match[1];
                    console.log(`  [Finnhub ${ticker}] ✓ Got domain from Finnhub (parsed): ${domain}`);
                  }
                }
              }
            }
            
            // Get sector from Finnhub if not from Yahoo Finance
            if (!sector && finnhubData) {
              const oldSector = sector;
              sector = finnhubData.finnhubIndustry || finnhubData.industry || null;
              if (sector && sector !== oldSector) {
                console.log(`  [Finnhub ${ticker}] ✓ Got sector from Finnhub: ${sector}`);
              }
            }
          } else {
            console.log(`  [Finnhub ${ticker}] API response not OK: ${finnhubResponse.status}`);
          }
        } else {
          console.log(`  [Finnhub ${ticker}] FINNHUB_API_KEY not found in environment variables`);
        }
      } catch (finnhubError) {
        console.log(`  [Finnhub ${ticker}] Fallback failed:`, finnhubError.message);
      }
    }
    
    // Log domain and sector information for debugging
    if (domain) {
      console.log(`  ✓ ${ticker}: Domain = ${domain}, Sector = ${sector || 'N/A'}`);
    } else {
      console.log(`  ✗ ${ticker}: No domain (website: ${website || 'N/A'}), Sector = ${sector || 'N/A'}`);
    }
    
    return {
      ticker,
      currentPrice,
      return1d: return1d !== null ? Number(return1d.toFixed(2)) : null,
      return5d: return5d !== null ? Number(return5d.toFixed(2)) : null,
      return20d: return20d !== null ? Number(return20d.toFixed(2)) : null,
      sma50: sma50 !== null ? Number(sma50.toFixed(2)) : null,
      distanceFromSMA50: distanceFromSMA50 !== null ? Number(distanceFromSMA50.toFixed(2)) : null,
      avgDollarVolume: avgDollarVolume !== null ? Number(avgDollarVolume.toFixed(2)) : null,
      sector,
      domain, // Domain name for logo URL
    };
    
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error.message);
    return {
      ticker,
      error: error.message,
    };
  }
}

/**
 * Fetch basic ticker details (name, sector, domain) from Finnhub
 * This is optimized for populating the tickers table
 * Includes retry logic for rate limiting
 * 
 * @param {string} ticker - Stock ticker symbol
 * @param {number} retries - Number of retries for rate limit errors (default: 3)
 * @returns {Promise<Object>} Object with ticker, name, sector, domain
 */
export async function fetchTickerDetails(ticker, retries = 3) {
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (!finnhubApiKey) {
    return {
      ticker,
      name: null,
      sector: null,
      domain: null,
      error: 'FINNHUB_API_KEY not found',
    };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const finnhubUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubApiKey}`;
      const finnhubResponse = await fetch(finnhubUrl);
      
      // Handle rate limiting (429) with exponential backoff
      if (finnhubResponse.status === 429) {
        if (attempt < retries) {
          const backoffDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, etc.
          console.log(`  [${ticker}] Rate limited (429), retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue; // Retry
        } else {
          return {
            ticker,
            name: null,
            sector: null,
            domain: null,
            error: `Rate limited (429) after ${retries + 1} attempts`,
          };
        }
      }
      
      if (!finnhubResponse.ok) {
        return {
          ticker,
          name: null,
          sector: null,
          domain: null,
          error: `Finnhub API error: ${finnhubResponse.status}`,
        };
      }
      
      const finnhubData = await finnhubResponse.json();
      
      // Extract name
      const name = finnhubData.name || null;
      
      // Extract sector
      const sector = finnhubData.finnhubIndustry || finnhubData.industry || finnhubData.gicsSector || null;
      
      // Extract domain from website URL
      let domain = null;
      const website = finnhubData.weburl || finnhubData.url || null;
      if (website) {
        try {
          const url = new URL(website.startsWith('http') ? website : `https://${website}`);
          domain = url.hostname.replace('www.', '');
        } catch (e) {
          // If URL parsing fails, try to extract domain manually
          const match = website.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
          if (match) {
            domain = match[1];
          }
        }
      }
      
      return {
        ticker,
        name,
        sector,
        domain,
      };
      
    } catch (error) {
      if (attempt < retries) {
        const backoffDelay = Math.pow(2, attempt) * 1000;
        console.log(`  [${ticker}] Error, retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${retries + 1}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }
      
      console.error(`Error fetching ticker details for ${ticker}:`, error.message);
      return {
        ticker,
        name: null,
        sector: null,
        domain: null,
        error: error.message,
      };
    }
  }
}

/**
 * Fetch basic ticker details for multiple tickers using Finnhub
 * Processes requests sequentially with delays to avoid rate limiting
 * 
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {number} delayMs - Delay between requests in milliseconds (default: 250ms)
 * @returns {Promise<Array<Object>>} Array of ticker detail objects
 */
export async function fetchBulkTickerDetails(tickers, delayMs = 250) {
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (!finnhubApiKey) {
    console.warn('⚠️  FINNHUB_API_KEY not found - cannot fetch ticker details');
    return tickers.map(ticker => ({
      ticker,
      name: null,
      sector: null,
      domain: null,
      error: 'FINNHUB_API_KEY not found',
    }));
  }

  console.log(`\n📊 Fetching ticker details for ${tickers.length} tickers from Finnhub...`);
  console.log(`   Processing sequentially with ${delayMs}ms delay between requests`);
  console.log(`   This will take approximately ${Math.ceil((tickers.length * delayMs) / 1000)} seconds\n`);
  
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  let rateLimitCount = 0;
  
  // Process sequentially to avoid rate limiting
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const progress = `[${i + 1}/${tickers.length}]`;
    
    try {
      const result = await fetchTickerDetails(ticker);
      results.push(result);
      
      if (result.error) {
        errorCount++;
        if (result.error.includes('429') || result.error.includes('Rate limited')) {
          rateLimitCount++;
        }
        console.log(`  ${progress} ✗ ${ticker}: ${result.error}`);
      } else {
        successCount++;
        const hasData = result.name || result.sector || result.domain;
        if (hasData) {
          console.log(`  ${progress} ✓ ${ticker}: ${result.name || ticker}${result.domain ? ` (${result.domain})` : ''}`);
        } else {
          console.log(`  ${progress} ⚠ ${ticker}: No data returned`);
        }
      }
      
      // Delay between requests (except for the last one)
      if (i < tickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      errorCount++;
      results.push({
        ticker,
        name: null,
        sector: null,
        domain: null,
        error: error.message,
      });
      console.log(`  ${progress} ✗ ${ticker}: ${error.message}`);
      
      // Still delay even on error
      if (i < tickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // Summary statistics
  const successful = results.filter(r => !r.error);
  const withName = successful.filter(r => r.name).length;
  const withDomain = successful.filter(r => r.domain).length;
  const withSector = successful.filter(r => r.sector).length;
  
  console.log(`\n📊 Fetch Summary:`);
  console.log(`   Total: ${results.length} tickers`);
  console.log(`   Successful: ${successCount} tickers`);
  console.log(`   Errors: ${errorCount} tickers`);
  if (rateLimitCount > 0) {
    console.log(`   ⚠️  Rate limited: ${rateLimitCount} tickers`);
  }
  if (successful.length > 0) {
    console.log(`   With name: ${withName} tickers (${((withName / successful.length) * 100).toFixed(1)}%)`);
    console.log(`   With domain: ${withDomain} tickers (${((withDomain / successful.length) * 100).toFixed(1)}%)`);
    console.log(`   With sector: ${withSector} tickers (${((withSector / successful.length) * 100).toFixed(1)}%)`);
  }
  
  return results;
}

/**
 * Fetch stock data for multiple tickers
 * Uses Yahoo Finance's free public API (no API key required)
 * 
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {number} batchSize - Number of tickers to fetch in parallel per batch (default: 100)
 * @returns {Promise<Array<Object>>} Array of stock data objects
 */
export async function fetchBulkStockData(tickers, batchSize = 100) {
  console.log(`\n📊 Fetching stock data for ${tickers.length} tickers...`);
  console.log(`   Using batch size of ${batchSize} (Yahoo Finance free API)`);
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (finnhubApiKey) {
    console.log(`   ✓ Finnhub API key found - will use as fallback for domain/sector`);
  } else {
    console.log(`   ⚠ Finnhub API key not found - only using Yahoo Finance`);
  }
  
  const results = [];
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tickers.length / batchSize);
    console.log(`  Fetching batch ${batchNum}/${totalBatches} (${batch.length} tickers)...`);
    
    const batchResults = await Promise.all(
      batch.map(ticker => fetchStockData(ticker))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting (only if not last batch)
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Summary statistics
  const successful = results.filter(r => !r.error);
  const withDomain = successful.filter(r => r.domain).length;
  const withSector = successful.filter(r => r.sector).length;
  
  console.log(`\n📊 Fetch Summary:`);
  console.log(`   Total: ${results.length} tickers`);
  console.log(`   Successful: ${successful.length} tickers`);
  if (successful.length > 0) {
    console.log(`   With domain: ${withDomain} tickers (${((withDomain / successful.length) * 100).toFixed(1)}%)`);
    console.log(`   With sector: ${withSector} tickers (${((withSector / successful.length) * 100).toFixed(1)}%)`);
  }
  
  return results;
}

