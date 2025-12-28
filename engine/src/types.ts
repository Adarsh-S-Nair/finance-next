/**
 * Market data types for the engine
 */

export interface Tick {
  ticker: string;
  price: number;
  size: number;
  timestamp: Date;
  side: 'buy' | 'sell';
}

export interface Candle {
  productId: string;  // Coinbase product ID (e.g., "BTC-USD")
  timeframe: string;  // Candle timeframe (e.g., "1m", "5m", "1h", "1d")
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CoinbaseTradeMessage {
  type: 'match' | 'ticker' | 'subscriptions' | 'error';
  product_id?: string;
  price?: string;
  size?: string;
  time?: string;
  side?: 'buy' | 'sell';
  message?: string;
}

