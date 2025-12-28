/**
 * Market Data Engine Entry Point
 * 
 * Streams crypto market data from Coinbase, aggregates into 1-minute candles,
 * and further aggregates into 5m, 1h, and 1d candles, writing all to Supabase.
 */

import { loadConfig, Config } from './config';
import { CoinbaseFeed } from './feeds/coinbase';
import { SupabaseStorage } from './storage/supabase';
import { Tick, Candle } from './types';

interface CandleBuffer {
  ticker: string;
  startTime: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
}

interface TimeframeConfig {
  timeframe: string;
  intervalMs: number;
  buffers: Map<string, CandleBuffer>;
}

class MarketDataEngine {
  private config: Config;
  private feed: CoinbaseFeed | null = null;
  private storage: SupabaseStorage;
  private candleBuffers: Map<string, CandleBuffer> = new Map(); // 1m buffers
  private timeframeConfigs: TimeframeConfig[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private currentProducts: string[] = [];
  private isShuttingDown = false;

  constructor() {
    this.config = loadConfig();
    this.storage = new SupabaseStorage(this.config);
    
    // Initialize timeframe configurations for aggregation
    this.timeframeConfigs = [
      { timeframe: '5m', intervalMs: 5 * 60 * 1000, buffers: new Map() },
      { timeframe: '1h', intervalMs: 60 * 60 * 1000, buffers: new Map() },
      { timeframe: '1d', intervalMs: 24 * 60 * 60 * 1000, buffers: new Map() },
    ];
  }

  async start(): Promise<void> {
    this.log('Starting Market Data Engine...');

    // Test database connection
    const dbConnected = await this.storage.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database. Please check your Supabase credentials.');
    }

    // Load products from portfolios
    await this.refreshProducts();
    
    // Initialize higher timeframe buffers for all current products
    for (const product of this.currentProducts) {
      for (const tfConfig of this.timeframeConfigs) {
        if (!tfConfig.buffers.has(product)) {
          tfConfig.buffers.set(product, this.createEmptyBufferForTimeframe(product, tfConfig.intervalMs));
        }
      }
    }

    // Set up periodic candle flushing
    this.startFlushInterval();

    // Set up periodic product refresh (every 5 minutes)
    this.startProductRefreshInterval();

    // Set up WebSocket feed
    this.feed = new CoinbaseFeed(this.config, {
      onTick: (tick) => this.handleTick(tick),
      onError: (error) => this.handleError(error),
      onConnect: () => this.log('Feed connected'),
      onDisconnect: () => this.log('Feed disconnected'),
    });

    this.feed.connect();

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    this.log('Market Data Engine started');
  }

  /**
   * Refresh the list of crypto products from portfolios
   * Updates subscriptions if products have changed
   */
  private async refreshProducts(): Promise<void> {
    try {
      const products = await this.storage.getCryptoProductsFromPortfolios();
      
      // If no products found, use fallback from config (for development/testing)
      if (products.length === 0) {
        this.log('No crypto portfolios found, using fallback products from config');
        this.currentProducts = this.config.coinbase.products;
      } else {
        this.currentProducts = products;
      }

      // Check if products have changed
      const productsChanged = 
        this.currentProducts.length !== this.candleBuffers.size ||
        !this.currentProducts.every(p => this.candleBuffers.has(p));

      if (productsChanged) {
        this.log(`Products changed. Updating subscriptions: ${this.currentProducts.join(', ')}`);
        
        // Update candle buffers
        const oldProducts = Array.from(this.candleBuffers.keys());
        const newProducts = this.currentProducts;

        // Remove buffers for products no longer needed (1m and all higher timeframes)
        for (const oldProduct of oldProducts) {
          if (!newProducts.includes(oldProduct)) {
            this.candleBuffers.delete(oldProduct);
            this.log(`Removed 1m buffer for ${oldProduct}`);
            // Remove higher timeframe buffers
            for (const tfConfig of this.timeframeConfigs) {
              tfConfig.buffers.delete(oldProduct);
            }
          }
        }

        // Add buffers for new products (1m and all higher timeframes)
        for (const newProduct of newProducts) {
          if (!this.candleBuffers.has(newProduct)) {
            this.candleBuffers.set(newProduct, this.createEmptyBuffer(newProduct));
            this.log(`Added 1m buffer for ${newProduct}`);
          }
          // Initialize buffers for higher timeframes
          for (const tfConfig of this.timeframeConfigs) {
            if (!tfConfig.buffers.has(newProduct)) {
              tfConfig.buffers.set(newProduct, this.createEmptyBufferForTimeframe(newProduct, tfConfig.intervalMs));
            }
          }
        }

        // Update config and reconnect feed if it's already connected
        this.config.coinbase.products = this.currentProducts;
        
        if (this.feed) {
          this.log('Reconnecting feed to update subscriptions...');
          this.feed.disconnect();
          // Feed will auto-reconnect and use new products
          setTimeout(() => {
            if (!this.isShuttingDown) {
              this.feed?.connect();
            }
          }, 1000);
        }
      }
    } catch (error: any) {
      this.log(`Error refreshing products: ${error.message}`);
      // Continue with existing products on error
    }
  }

  private startProductRefreshInterval(): void {
    // Refresh products every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.refreshProducts().catch((error) => {
        this.log(`Error in product refresh: ${error.message}`);
      });
    }, 5 * 60 * 1000);
  }

  private handleTick(tick: Tick): void {
    const buffer = this.candleBuffers.get(tick.ticker);
    if (!buffer) {
      this.log(`Warning: Received tick for unknown ticker: ${tick.ticker}`);
      return;
    }

    // Check if tick belongs to current candle window
    const tickTime = tick.timestamp.getTime();
    const bufferStartTime = buffer.startTime.getTime();
    const bufferEndTime = bufferStartTime + this.config.aggregation.candleIntervalMs;

    if (tickTime < bufferStartTime || tickTime >= bufferEndTime) {
      // Tick belongs to a different candle window - flush current and start new
      this.flushCandle(tick.ticker);
      this.candleBuffers.set(tick.ticker, this.createEmptyBuffer(tick.ticker, tick.timestamp));
      this.handleTick(tick); // Process this tick in the new buffer
      return;
    }

    // Update candle buffer with tick data
    if (buffer.open === null) {
      buffer.open = tick.price;
      buffer.high = tick.price;
      buffer.low = tick.price;
    } else {
      buffer.high = Math.max(buffer.high!, tick.price);
      buffer.low = Math.min(buffer.low!, tick.price);
    }
    buffer.close = tick.price;
    buffer.volume += tick.size * tick.price; // Dollar volume
  }

  private createEmptyBuffer(ticker: string, timestamp?: Date): CandleBuffer {
    const now = timestamp || new Date();
    const startTime = new Date(
      Math.floor(now.getTime() / this.config.aggregation.candleIntervalMs) *
        this.config.aggregation.candleIntervalMs
    );

    return {
      ticker,
      startTime,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: 0,
    };
  }

  private startFlushInterval(): void {
    // Flush candles every minute (aligned to minute boundaries)
    const now = new Date();
    const msUntilNextMinute = this.config.aggregation.candleIntervalMs - (now.getTime() % this.config.aggregation.candleIntervalMs);
    
    setTimeout(() => {
      this.flushAllCandles();
      this.flushInterval = setInterval(() => {
        this.flushAllCandles();
      }, this.config.aggregation.candleIntervalMs);
    }, msUntilNextMinute);
  }

  private flushAllCandles(): void {
    for (const ticker of this.candleBuffers.keys()) {
      this.flushCandle(ticker);
      // Start new buffer for next minute
      this.candleBuffers.set(ticker, this.createEmptyBuffer(ticker));
    }
  }

  private flushCandle(productId: string): void {
    const buffer = this.candleBuffers.get(productId);
    if (!buffer || buffer.open === null) {
      // No data in buffer, skip
      return;
    }

    // Create and write 1m candle
    const candle1m: Candle = {
      productId: buffer.ticker,
      timeframe: '1m',
      timestamp: buffer.startTime,
      open: buffer.open,
      high: buffer.high!,
      low: buffer.low!,
      close: buffer.close!,
      volume: buffer.volume,
    };

    const candlesToWrite: Candle[] = [candle1m];

    // Add 1m candle to higher timeframe buffers and check if they should be flushed
    for (const tfConfig of this.timeframeConfigs) {
      const tfBuffer = tfConfig.buffers.get(productId);
      if (!tfBuffer) continue;

      const candleTime = candle1m.timestamp.getTime();
      const tfStartTime = tfBuffer.startTime.getTime();
      
      // Calculate which higher timeframe bucket this 1m candle belongs to
      const candleBucketStart = Math.floor(candleTime / tfConfig.intervalMs) * tfConfig.intervalMs;

      if (candleBucketStart !== tfStartTime) {
        // 1m candle belongs to a different higher timeframe bucket
        // Flush the current bucket if it has data
        if (tfBuffer.open !== null) {
          const tfCandle: Candle = {
            productId: buffer.ticker,
            timeframe: tfConfig.timeframe,
            timestamp: tfBuffer.startTime,
            open: tfBuffer.open,
            high: tfBuffer.high!,
            low: tfBuffer.low!,
            close: tfBuffer.close!,
            volume: tfBuffer.volume,
          };
          candlesToWrite.push(tfCandle);
        }

        // Start new bucket for the 1m candle's timeframe
        const newBucketStart = new Date(candleBucketStart);
        tfConfig.buffers.set(productId, {
          ticker: buffer.ticker,
          startTime: newBucketStart,
          open: candle1m.open,
          high: candle1m.high,
          low: candle1m.low,
          close: candle1m.close,
          volume: candle1m.volume,
        });
      } else {
        // 1m candle belongs to the current higher timeframe bucket
        // Add it to the buffer
        if (tfBuffer.open === null) {
          tfBuffer.open = candle1m.open;
          tfBuffer.high = candle1m.high;
          tfBuffer.low = candle1m.low;
        } else {
          tfBuffer.high = Math.max(tfBuffer.high!, candle1m.high);
          tfBuffer.low = Math.min(tfBuffer.low!, candle1m.low);
        }
        tfBuffer.close = candle1m.close;
        tfBuffer.volume += candle1m.volume;
      }
    }

    // Upsert all candles to database (async, don't await to avoid blocking)
    this.storage.upsertCandles(candlesToWrite).catch((error) => {
      this.log(`Error upserting candles for ${productId}: ${error.message}`);
    });
  }

  private createEmptyBufferForTimeframe(ticker: string, intervalMs: number, timestamp?: Date): CandleBuffer {
    const now = timestamp || new Date();
    const startTime = new Date(
      Math.floor(now.getTime() / intervalMs) * intervalMs
    );

    return {
      ticker,
      startTime,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: 0,
    };
  }

  private handleError(error: Error): void {
    this.log(`Error: ${error.message}`);
    // Feed will handle reconnection automatically
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    this.log('Shutting down Market Data Engine...');

    // Stop accepting new ticks
    if (this.feed) {
      this.feed.disconnect();
    }

    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Flush any remaining candles (1m and higher timeframes)
    this.flushAllCandles();
    
    // Also flush any incomplete higher timeframe buffers
    for (const tfConfig of this.timeframeConfigs) {
      for (const [productId, buffer] of tfConfig.buffers.entries()) {
        if (buffer.open !== null) {
          const candle: Candle = {
            productId: buffer.ticker,
            timeframe: tfConfig.timeframe,
            timestamp: buffer.startTime,
            open: buffer.open,
            high: buffer.high!,
            low: buffer.low!,
            close: buffer.close!,
            volume: buffer.volume,
          };
          this.storage.upsertCandles([candle]).catch((error) => {
            this.log(`Error upserting final ${tfConfig.timeframe} candle for ${productId}: ${error.message}`);
          });
        }
      }
    }

    // Give a moment for final writes
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.log('Market Data Engine stopped');
    process.exit(0);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Engine] ${message}`);
  }
}

// Start the engine
const engine = new MarketDataEngine();
engine.start().catch((error) => {
  console.error('Failed to start engine:', error);
  process.exit(1);
});

