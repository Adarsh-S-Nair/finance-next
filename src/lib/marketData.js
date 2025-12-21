/**
 * Market Data Utilities
 * Functions for fetching market data, index constituents, etc.
 */

import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabaseAdmin';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

/**
 * Get NASDAQ-100 constituents from Financial Modeling Prep
 * Free tier: 250 calls/day
 * 
 * This is the primary method as FMP has a direct endpoint for NASDAQ-100.
 * 
 * Alternative APIs (if needed):
 * - Polygon.io: Has index data but requires more setup
 * - IEX Cloud: Doesn't have direct NDX endpoint
 * 
 * @returns {Promise<Array<string>>} Array of ticker symbols
 */
export async function fetchNasdaq100Constituents() {
  const apiKey = process.env.FMP_API_KEY;
  
  if (!apiKey) {
    throw new Error('FMP_API_KEY environment variable is not set. Get a free API key at https://site.financialmodelingprep.com/developer/docs/');
  }

  try {
    // Financial Modeling Prep endpoint for NASDAQ-100 index constituents
    const url = `https://financialmodelingprep.com/api/v3/nasdaq_constituent?apikey=${apiKey}`;
    
    console.log('📡 Fetching NASDAQ-100 constituents from Financial Modeling Prep...');
    
    const response = await fetch(url, {
      // Add cache control to avoid hitting rate limits unnecessarily
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Financial Modeling Prep API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += ` - ${errorJson['Error Message'] || errorJson.message || errorText}`;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Extract ticker symbols
    if (Array.isArray(data) && data.length > 0) {
      const tickers = data
        .map(item => item.symbol || item.ticker)
        .filter(Boolean)
        .sort(); // Sort for consistency
      
      console.log(`✅ Fetched ${tickers.length} NASDAQ-100 constituents`);
      return tickers;
    }
    
    throw new Error('Unexpected response format from Financial Modeling Prep - empty or invalid data');
    
  } catch (error) {
    console.error('❌ Error fetching NASDAQ-100 constituents:', error);
    throw error;
  }
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
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  // Call the database function to sync constituents
  const { error } = await supabaseAdmin.rpc('sync_nasdaq100_constituents', {
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
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }

  const { data, error } = await supabaseAdmin
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
 * Sync NASDAQ-100 constituents (fetch and save to both DB and file)
 * 
 * @returns {Promise<{tickers: Array<string>, count: number, lastUpdated: string}>}
 */
export async function syncNasdaq100Constituents() {
  console.log('🔄 Fetching NASDAQ-100 constituents...');
  
  const tickers = await fetchNasdaq100Constituents();
  
  if (!tickers || tickers.length === 0) {
    throw new Error('No tickers returned from API');
  }
  
  if (tickers.length < 90) {
    console.warn(`⚠️  Warning: Expected ~100 tickers, got ${tickers.length}`);
  }
  
  // Save to Supabase (primary storage)
  try {
    await saveNasdaq100ConstituentsToDB(tickers);
  } catch (dbError) {
    console.error('❌ Failed to save to database:', dbError.message);
    console.log('💡 Falling back to local file storage...');
    // Fallback to local file if DB fails
    saveNasdaq100Constituents(tickers);
    throw dbError; // Still throw so user knows DB sync failed
  }
  
  // Also save to local file as backup
  saveNasdaq100Constituents(tickers);
  
  return {
    tickers,
    count: tickers.length,
    lastUpdated: new Date().toISOString(),
  };
}

