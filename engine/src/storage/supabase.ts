/**
 * Supabase client and storage helpers
 * Handles idempotent upsert of candles
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Config } from '../config';
import { Candle } from '../types';

export class SupabaseStorage {
  private client: SupabaseClient;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
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
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client.from('crypto_candles').select('ticker').limit(1);
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine for a test
        throw error;
      }
      return true;
    } catch (error) {
      this.log(`Database connection test failed: ${error}`);
      return false;
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SupabaseStorage] ${message}`);
  }
}

