/**
 * CoinGecko logo and name lookup for crypto tickers.
 *
 * This is the only file in the holdingsSync module that performs
 * network IO (besides the orchestrator's Supabase/Plaid calls). It's
 * isolated so the pure modules stay pure and so we can stub it trivially
 * in tests if needed.
 *
 * CoinGecko's free tier allows ~10–30 calls/minute, so the bulk helper
 * batches requests and sleeps briefly between batches. We also cache
 * lookups in memory for the duration of a single sync to avoid repeat
 * lookups when multiple holdings share a ticker.
 */

import { createLogger } from '../../logger';

const logger = createLogger('holdings-sync:coingecko');

export interface CryptoInfo {
  logo: string | null;
  name: string | null;
}

const BATCH_SIZE = 5;
const DELAY_MS = 200; // 200ms between batches → ~25 calls/minute

/**
 * Fetch crypto info for a single ticker from CoinGecko's search API.
 * Returns `{ logo: null, name: null }` on any failure (never throws).
 *
 * A per-invocation cache may be passed in to dedupe across calls.
 */
export async function fetchCryptoInfo(
  ticker: string,
  cache?: Map<string, CryptoInfo>
): Promise<CryptoInfo> {
  const upper = ticker.toUpperCase();
  if (cache?.has(upper)) {
    return cache.get(upper) as CryptoInfo;
  }

  const empty: CryptoInfo = { logo: null, name: null };

  try {
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      logger.warn('CoinGecko search non-ok', { ticker, status: response.status });
      cache?.set(upper, empty);
      return empty;
    }

    const data = (await response.json()) as { coins?: Array<Record<string, unknown>> };
    const coins = data.coins ?? [];

    const exactMatch = coins.find((c) => String(c.symbol ?? '').toUpperCase() === upper);
    const coin = exactMatch ?? coins[0];

    if (!coin) {
      cache?.set(upper, empty);
      return empty;
    }

    const logo =
      (coin.large as string | undefined) ??
      (coin.small as string | undefined) ??
      (coin.thumb as string | undefined) ??
      null;
    const name = (coin.name as string | undefined) ?? null;

    const result: CryptoInfo = { logo, name };
    cache?.set(upper, result);
    return result;
  } catch (err) {
    logger.warn('CoinGecko search threw', { ticker, error: (err as Error).message });
    cache?.set(upper, empty);
    return empty;
  }
}

/**
 * Fetch crypto info for many tickers, respecting CoinGecko's free-tier
 * rate limits. Returns a map keyed by uppercase ticker.
 */
export async function fetchBulkCryptoInfo(
  tickers: string[]
): Promise<Map<string, CryptoInfo>> {
  const cache = new Map<string, CryptoInfo>();
  const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((ticker) => fetchCryptoInfo(ticker, cache)));
    if (i + BATCH_SIZE < unique.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return cache;
}
