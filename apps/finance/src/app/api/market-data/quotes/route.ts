/**
 * Stock & Crypto Quotes API — thin HTTP wrapper around the shared
 * `fetchQuotesForTickers` helper. Same helper is used server-side by
 * the agent investment tools so quotes the chat surfaces match what
 * the UI shows.
 *
 * GET /api/market-data/quotes?tickers=AAPL,MSFT,NVDA,BTC,ETH
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchQuotesForTickers } from '../../../../lib/quotes';

const CACHE_TTL_MIN = 5;

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const tickersParam = searchParams.get('tickers');

    if (!tickersParam) {
      return NextResponse.json({ error: 'Missing tickers parameter' }, { status: 400 });
    }

    const tickers = tickersParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    if (tickers.length === 0) {
      return NextResponse.json({ error: 'No valid tickers provided' }, { status: 400 });
    }

    if (tickers.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 tickers per request' }, { status: 400 });
    }

    const result = await fetchQuotesForTickers(tickers);

    return NextResponse.json({
      quotes: result.quotes,
      fromCache: result.fromCache,
      fetched: result.fetched,
      cryptoCount: result.cryptoCount,
      cacheTTL: `${CACHE_TTL_MIN} minutes`,
    });
  } catch (error) {
    console.error('Quotes API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
