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
  ticker: string;
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

