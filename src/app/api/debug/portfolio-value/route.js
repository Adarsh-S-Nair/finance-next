import { NextResponse } from 'next/server';

// Simple debug endpoint to log portfolio valuation details on the server
export async function POST(request) {
  try {
    const body = await request.json();

    const {
      portfolioId,
      uiTotal,
      cash,
      holdingsValue,
      holdings = [],
    } = body || {};

    // Log a concise one-line summary
    console.log(
      `[Debug] Portfolio value: portfolioId=${portfolioId}, uiTotal=${uiTotal}, cash=${cash}, holdingsValue=${holdingsValue}`
    );

    // Log a clear holdings breakdown: price * shares = value
    if (holdings.length > 0) {
      console.log(`[Debug] Holdings breakdown (${portfolioId}):`);
      holdings.forEach((h) => {
        console.log(
          `  ${h.ticker}: price=${h.price} x shares=${h.shares} = value=${h.marketValue.toFixed(
            2
          )}${h.fromQuote ? '' : ' (avg_cost)'}`
        );
      });
      console.log(
        `[Debug] Total check (${portfolioId}): cash=${cash} + holdings=${holdingsValue} = ${Number(
          cash
        ) + Number(holdingsValue)} (uiTotal=${uiTotal})`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Debug] Error logging portfolio value breakdown', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}



