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
 * 
 * @returns {Promise<Array<string>>} Array of ticker symbols
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
    
    // Extract tickers from the table structure
    // Structure: <table> -> <tbody> -> <tr> -> first <td> (ticker symbol)
    const tickers = [];
    
    // Find the table (there should be only one)
    const table = $('table').first();
    
    if (table.length === 0) {
      throw new Error('No table found on the page');
    }
    
    // Extract first <td> from each <tr> in <tbody>
    table.find('tbody tr').each((i, row) => {
      const firstTd = $(row).find('td').first();
      const ticker = firstTd.text().trim().toUpperCase();
      
      // Validate it looks like a ticker (1-5 uppercase letters)
      if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
        tickers.push(ticker);
      }
    });
    
    // If tbody approach didn't work, try direct tr -> first td
    if (tickers.length === 0) {
      table.find('tr').each((i, row) => {
        const firstTd = $(row).find('td').first();
        const ticker = firstTd.text().trim().toUpperCase();
        
        if (ticker && /^[A-Z]{1,5}$/.test(ticker)) {
          tickers.push(ticker);
        }
      });
    }
    
    // Remove duplicates and sort
    const uniqueTickers = [...new Set(tickers)].sort();
    
    if (uniqueTickers.length < 50) {
      // If we didn't get enough tickers, log the HTML structure for debugging
      console.warn('⚠️  Only found', uniqueTickers.length, 'tickers. The page structure may have changed.');
      console.log('📋 Found tickers so far:', uniqueTickers.slice(0, 10).join(', '), '...');
      
      // Log table structure for debugging
      const tableCount = $('table').length;
      const tbodyCount = $('table tbody').length;
      const trCount = $('table tbody tr').length;
      console.log(`🔍 Debug: Found ${tableCount} table(s), ${tbodyCount} tbody(s), ${trCount} tr(s) in tbody`);
    }
    
    console.log(`✅ Scraped ${uniqueTickers.length} NASDAQ-100 constituents from official website`);
    return uniqueTickers;
    
  } catch (error) {
    console.error('❌ Error scraping NASDAQ-100 constituents:', error);
    throw error;
  }
}

/**
 * Get NASDAQ-100 constituents (convenience wrapper)
 * Uses web scraping from official NASDAQ website
 * 
 * @returns {Promise<Array<string>>} Array of ticker symbols
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
 * 
 * @param {Array<string>} tickers - Array of ticker symbols
 */
export async function saveNasdaq100ConstituentsToDB(tickers) {
  const admin = await getSupabaseAdmin();
  
  if (!admin) {
    throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  // Call the database function to sync constituents
  const { error } = await admin.rpc('sync_nasdaq100_constituents', {
    tickers: tickers.map(t => t.toUpperCase()), // Ensure uppercase
  });

  if (error) {
    throw new Error(`Failed to save to database: ${error.message}`);
  }

  console.log(`✅ Synced ${tickers.length} NASDAQ-100 constituents to database`);
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
 * Sync NASDAQ-100 constituents (fetch and log - no DB updates for now)
 * 
 * @returns {Promise<{tickers: Array<string>, count: number, lastUpdated: string}>}
 */
export async function syncNasdaq100Constituents() {
  console.log('🔄 Fetching NASDAQ-100 constituents...');
  
  const tickers = await fetchNasdaq100Constituents();
  
  if (!tickers || tickers.length === 0) {
    throw new Error('No tickers returned from scraper');
  }
  
  if (tickers.length < 90) {
    console.warn(`⚠️  Warning: Expected ~100 tickers, got ${tickers.length}`);
  }
  
  // For now, just log the tickers (no DB updates)
  console.log('\n📊 SCRAPED NASDAQ-100 CONSTITUENTS:');
  console.log('========================================');
  console.log(`Total tickers found: ${tickers.length}`);
  console.log('\nTicker symbols:');
  tickers.forEach((ticker, index) => {
    const line = `${(index + 1).toString().padStart(3, ' ')}. ${ticker}`;
    console.log(line);
  });
  console.log('========================================\n');
  
  // Don't save to DB or file for now - just logging
  // TODO: Re-enable DB/file saving once scraping is verified
  
  return {
    tickers,
    count: tickers.length,
    lastUpdated: new Date().toISOString(),
  };
}

