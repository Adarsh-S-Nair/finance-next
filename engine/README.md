# Market Data Engine

A 24/7 crypto market data streaming engine that connects to Coinbase's public WebSocket API, aggregates trades into 1-minute OHLC candles, and stores them in Supabase.

## Features

- **Real-time streaming**: Connects to Coinbase WebSocket feed (no API key required)
- **Automatic aggregation**: Converts trade ticks into 1-minute OHLC candles
- **Idempotent storage**: Uses Supabase upserts to prevent duplicate data
- **Resilient**: Automatic reconnection with exponential backoff
- **Production-ready**: Graceful shutdown, error handling, and logging

## Architecture

```
engine/
├── src/
│   ├── index.ts           # Main entry point, orchestrates feed + storage
│   ├── config.ts          # Environment variables and configuration
│   ├── types.ts           # TypeScript interfaces (Tick, Candle)
│   ├── feeds/
│   │   └── coinbase.ts    # Coinbase WebSocket client
│   └── storage/
│       └── supabase.ts    # Supabase client and upsert helpers
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Setup

### Prerequisites

- Node.js 18+
- Supabase project with `crypto_candles` table
- Environment variables configured

### Database Schema

The engine expects a `crypto_candles` table with the following structure:

```sql
CREATE TABLE crypto_candles (
  ticker TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC(12, 4) NOT NULL,
  high NUMERIC(12, 4) NOT NULL,
  low NUMERIC(12, 4) NOT NULL,
  close NUMERIC(12, 4) NOT NULL,
  volume NUMERIC(15, 2) NOT NULL,
  PRIMARY KEY (ticker, timestamp)
);

CREATE INDEX idx_crypto_candles_ticker_timestamp 
  ON crypto_candles(ticker, timestamp DESC);
```

### Installation

```bash
cd engine
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for bypassing RLS)

### Development

```bash
# Build TypeScript
npm run build

# Run in development mode (with ts-node)
npm run dev

# Run production build
npm start
```

## Deployment

### Docker

```bash
# Build image
docker build -t market-data-engine .

# Run container
docker run -d \
  --name market-data-engine \
  --env-file .env \
  market-data-engine
```

### Fly.io

```bash
# Install flyctl
# Create fly.toml (see example below)
fly deploy
```

### Environment Variables

The engine uses the following environment variables:

- `SUPABASE_URL` (required): Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (required): Supabase service role key
- `NEXT_PUBLIC_SUPABASE_URL` (fallback): Can be used if `SUPABASE_URL` is not set

## How It Works

1. **Connection**: Engine connects to Coinbase WebSocket feed
2. **Subscription**: Subscribes to `matches` channel for BTC-USD and ETH-USD
3. **Tick Processing**: Each trade message is normalized into a `Tick` object
4. **Aggregation**: Ticks are buffered and aggregated into 1-minute candles
5. **Storage**: Candles are upserted to Supabase every minute (aligned to minute boundaries)
6. **Reconnection**: On disconnect, automatically reconnects with exponential backoff

## Monitoring

The engine logs all important events:
- Connection status
- Reconnection attempts
- Database write operations
- Errors

Logs are written to stdout/stderr and can be captured by your deployment platform.

## Graceful Shutdown

The engine handles `SIGTERM` and `SIGINT` signals:
1. Stops accepting new ticks
2. Disconnects from WebSocket
3. Flushes any pending candles
4. Exits cleanly

## Notes

- The engine does not depend on Next.js runtime
- No hardcoded asset metadata (assumes tickers exist in database)
- Long-running, event-driven architecture (no cron/poll loops)
- Uses dollar volume (price × size) for volume calculation

