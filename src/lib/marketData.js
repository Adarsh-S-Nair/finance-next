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

  // Update metadata (name, etc.) for each constituent
  for (const constituent of constituents) {
    const updates = {};
    if (constituent.name) {
      updates.name = constituent.name;
    }
    
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin
        .from('nasdaq100_constituents')
        .update(updates)
        .eq('ticker', constituent.ticker.toUpperCase());
      
      if (updateError) {
        console.warn(`⚠️  Failed to update metadata for ${constituent.ticker}:`, updateError.message);
      }
    }
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
  
  // Don't save to DB yet - just logging for now
  // TODO: Re-enable DB saving once we verify the scraper works correctly
  // try {
  //   await saveNasdaq100ConstituentsToDB(constituents);
  // } catch (dbError) {
  //   console.error('❌ Failed to save to database:', dbError.message);
  // }
  
  // Save to local file as backup
  saveNasdaq100Constituents(tickers);
  
  return {
    tickers,
    count: constituents.length,
    lastUpdated: new Date().toISOString(),
  };
}

