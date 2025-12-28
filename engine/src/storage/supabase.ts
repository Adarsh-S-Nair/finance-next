/**
 * Supabase client and storage helpers
 * Handles idempotent upsert of candles
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Config } from '../config';
import { Candle } from '../types';

export class SupabaseStorage {
  private client: SupabaseClient;

  constructor(config: Config) {
    this.client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Upsert candles into the database with idempotency
   * Uses the crypto_candles table schema:
   * - product_id (text, e.g., "BTC-USD")
   * - interval (text, e.g., "1m")
   * - time (timestamptz)
   * - open, high, low, close, volume (numeric)
   * - unique constraint on (product_id, interval, time)
   */
  async upsertCandles(candles: Candle[]): Promise<void> {
    if (candles.length === 0) {
      return;
    }

    const rows = candles.map((candle) => ({
      product_id: candle.productId,
      timeframe: candle.timeframe,
      time: candle.timestamp.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    const { error } = await this.client
      .from('crypto_candles')
      .upsert(rows, {
        onConflict: 'product_id,timeframe,time',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to upsert candles: ${error.message}`);
    }

    this.log(`Upserted ${candles.length} candle(s) for ${new Set(candles.map((c) => c.productId)).size} product(s)`);
  }

  /**
   * Get list of crypto products to subscribe to from portfolios
   * Queries all crypto portfolios and extracts their crypto_assets arrays
   */
  async getCryptoProductsFromPortfolios(): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('portfolios')
        .select('crypto_assets')
        .eq('asset_type', 'crypto')
        .not('crypto_assets', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch crypto portfolios: ${error.message}`);
      }

      // Extract all unique crypto symbols from all portfolios
      const cryptoSet = new Set<string>();
      
      if (data) {
        for (const portfolio of data) {
          if (portfolio.crypto_assets && Array.isArray(portfolio.crypto_assets)) {
            for (const symbol of portfolio.crypto_assets) {
              if (typeof symbol === 'string' && symbol.length > 0) {
                cryptoSet.add(symbol.toUpperCase());
              }
            }
          }
        }
      }

      // Convert crypto symbols (BTC, ETH) to Coinbase product IDs (BTC-USD, ETH-USD)
      const products = Array.from(cryptoSet)
        .map((symbol) => `${symbol}-USD`)
        .sort();

      this.log(`Found ${products.length} crypto product(s) from portfolios: ${products.join(', ')}`);
      return products;
    } catch (error: any) {
      this.log(`Error fetching crypto products: ${error.message}`);
      // Return empty array on error - engine will retry later
      return [];
    }
  }

  /**
   * Test database connection
   * More lenient - allows table to not exist yet (PGRST204)
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple query to test connection
      // Use a system table or simple query that should always work
      const { error } = await this.client.from('crypto_candles').select('product_id').limit(1);
      
      if (error) {
        // PGRST116 = no rows returned (table exists, just empty) - OK
        if (error.code === 'PGRST116') {
          this.log('Database connection successful (table exists but is empty)');
          return true;
        }
        
        // PGRST204 = relation does not exist - table not created yet, but connection works
        if (error.code === 'PGRST204') {
          this.log('Database connection successful (table does not exist yet - will be created later)');
          return true;
        }
        
        // For other errors, log full details
        const errorInfo: any = {
          message: error.message || 'Unknown error',
          code: error.code || 'unknown',
        };
        
        if (error.details) errorInfo.details = error.details;
        if (error.hint) errorInfo.hint = error.hint;
        
        this.log(`Database query error: ${JSON.stringify(errorInfo, null, 2)}`);
        
        // If it's a connection/auth error, fail
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth')) {
          throw error;
        }
        
        // Otherwise, assume connection works but table doesn't exist
        return true;
      }
      
      this.log('Database connection successful');
      return true;
    } catch (error: any) {
      // Handle non-Supabase errors (network, auth, etc.)
      const errorDetails: any = {
        type: 'connection_error',
      };
      
      if (error instanceof Error) {
        errorDetails.message = error.message;
        errorDetails.name = error.name;
        if (error.stack) errorDetails.stack = error.stack;
      } else if (error && typeof error === 'object') {
        Object.assign(errorDetails, error);
      } else {
        errorDetails.raw = String(error);
      }
      
      this.log(`Database connection test failed: ${JSON.stringify(errorDetails, null, 2)}`);
      return false;
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SupabaseStorage] ${message}`);
  }
}

