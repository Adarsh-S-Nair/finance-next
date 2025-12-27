/**
 * Coinbase WebSocket feed client
 * Connects to public Coinbase WebSocket API (no authentication required)
 */

import WebSocket from 'ws';
import { Config } from '../config';
import { Tick, CoinbaseTradeMessage } from '../types';

export interface CoinbaseFeedCallbacks {
  onTick: (tick: Tick) => void;
  onError: (error: Error) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export class CoinbaseFeed {
  private ws: WebSocket | null = null;
  private config: Config;
  private callbacks: CoinbaseFeedCallbacks;
  private reconnectDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  constructor(config: Config, callbacks: CoinbaseFeedCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.reconnectDelay = config.reconnect.initialDelayMs;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.log('Connecting to Coinbase WebSocket...');

    try {
      this.ws = new WebSocket(this.config.coinbase.wsUrl);

      this.ws.on('open', () => {
        this.log('Connected to Coinbase WebSocket');
        this.reconnectDelay = this.config.reconnect.initialDelayMs;
        this.subscribe();
        this.callbacks.onConnect();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: CoinbaseTradeMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.log(`Error parsing message: ${error}`);
        }
      });

      this.ws.on('error', (error: Error) => {
        this.log(`WebSocket error: ${error.message}`);
        this.callbacks.onError(error);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.log(`WebSocket closed: code=${code}, reason=${reason.toString()}`);
        this.callbacks.onDisconnect();
        this.ws = null;

        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this.log(`Failed to create WebSocket: ${error}`);
      this.callbacks.onError(error as Error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscribeMessage = {
      type: 'subscribe',
      product_ids: this.config.coinbase.products,
      channels: ['matches'], // 'matches' channel provides trade data
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    this.log(`Subscribed to products: ${this.config.coinbase.products.join(', ')}`);
  }

  private handleMessage(message: CoinbaseTradeMessage): void {
    if (message.type === 'error') {
      this.log(`Coinbase error: ${message.message || 'Unknown error'}`);
      this.callbacks.onError(new Error(message.message || 'Coinbase API error'));
      return;
    }

    if (message.type === 'match' && message.product_id && message.price && message.size && message.time) {
      const tick: Tick = {
        ticker: message.product_id,
        price: parseFloat(message.price),
        size: parseFloat(message.size),
        timestamp: new Date(message.time),
        side: message.side || 'buy',
      };

      this.callbacks.onTick(tick);
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed || this.reconnectTimer) {
      return;
    }

    this.log(`Scheduling reconnect in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(
        this.reconnectDelay * this.config.reconnect.backoffMultiplier,
        this.config.reconnect.maxDelayMs
      );
      this.connect();
    }, this.reconnectDelay);
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CoinbaseFeed] ${message}`);
  }
}

