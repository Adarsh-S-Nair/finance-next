import { NextResponse } from 'next/server';

// Server-side logging endpoint for benchmark prices
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      portfolioId,
      ticker = 'QQQ',
      prices = {},
    } = body || {};

    // Log all benchmark prices sorted by date
    const sortedEntries = Object.entries(prices).sort(([a], [b]) => a.localeCompare(b));
    console.log(`[Benchmark ${ticker}] All prices for portfolio ${portfolioId}:`);
    sortedEntries.forEach(([date, price]) => {
      console.log(`  ${date}: $${price.toFixed(2)}`);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Debug] Error logging benchmark prices', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

