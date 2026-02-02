import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// GET: Query CRM holdings from database for debugging (v2)
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'No admin client',
        env: {
          has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          has_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });
    }

    // Query CRM holdings directly
    const { data: crmHoldings, error: holdingsError } = await supabaseAdmin
      .from('holdings')
      .select(`
        id,
        ticker,
        shares,
        avg_cost,
        asset_type,
        portfolio_id
      `)
      .ilike('ticker', 'CRM');

    if (holdingsError) {
      return NextResponse.json({
        error: 'Holdings query failed',
        details: holdingsError.message,
        code: holdingsError.code
      });
    }

    // Get plaid items count
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, institution_id');

    return NextResponse.json({
      crm_holdings: crmHoldings,
      total_crm_shares: crmHoldings?.reduce((sum, h) => sum + parseFloat(h.shares || 0), 0),
      holdings_count: crmHoldings?.length || 0,
      plaid_items_count: items?.length || 0,
      plaid_items_error: itemsError?.message
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Exception',
      message: err.message
    });
  }
}

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



