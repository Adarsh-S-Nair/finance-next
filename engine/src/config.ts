/**
 * Configuration and environment variables
 */

export interface Config {
  supabase: {
    url: string;
    serviceKey: string;
  };
  coinbase: {
    wsUrl: string;
    products: string[];
  };
  aggregation: {
    candleIntervalMs: number;
  };
  reconnect: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue!;
}

export function loadConfig(): Config {
  return {
    supabase: {
      url: getEnvVar('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    },
    coinbase: {
      wsUrl: 'wss://ws-feed.exchange.coinbase.com',
      products: ['BTC-USD', 'ETH-USD'], // Fallback if no portfolios found
    },
    aggregation: {
      candleIntervalMs: 60 * 1000, // 1 minute
    },
    reconnect: {
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 1.5,
    },
  };
}

