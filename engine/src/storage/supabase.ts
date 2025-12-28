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
   * Assumes table: crypto_candles with columns:
   * - ticker (text)
   * - timestamp (timestamptz)
   * - open, high, low, close (numeric)
   * - volume (numeric)
   * - unique constraint on (ticker, timestamp)
   */
  async upsertCandles(candles: Candle[]): Promise<void> {
    if (candles.length === 0) {
      return;
    }

    const rows = candles.map((candle) => ({
      ticker: candle.ticker,
      timestamp: candle.timestamp.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    const { error } = await this.client
      .from('crypto_candles')
      .upsert(rows, {
        onConflict: 'ticker,timestamp',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to upsert candles: ${error.message}`);
    }

    this.log(`Upserted ${candles.length} candle(s) for ${new Set(candles.map((c) => c.ticker)).size} ticker(s)`);
  }

  /**
   * Test database connection
   * More lenient - allows table to not exist yet (PGRST204)
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple query to test connection
      // Use a system table or simple query that should always work
      const { error } = await this.client.from('crypto_candles').select('ticker').limit(1);
      
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

