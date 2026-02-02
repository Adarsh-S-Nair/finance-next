import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getInvestmentsHoldings } from '../../../../lib/plaidClient';

// GET: Query CRM holdings from database AND Plaid for debugging (v3)
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'No admin client'
      });
    }

    // Query CRM holdings from database
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

    // Get plaid items with access tokens
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, access_token');

    // Query Plaid directly for raw CRM data
    let plaidCrmData = [];
    if (items && items.length > 0) {
      for (const item of items) {
        try {
          const holdingsResponse = await getInvestmentsHoldings(item.access_token);
          const { holdings, securities } = holdingsResponse;

          // Create security map
          const securityMap = new Map();
          (securities || []).forEach(s => securityMap.set(s.security_id, s));

          // Find CRM holdings
          const crmFromPlaid = (holdings || [])
            .filter(h => {
              const sec = securityMap.get(h.security_id);
              return sec?.ticker_symbol?.toUpperCase() === 'CRM';
            })
            .map(h => {
              const sec = securityMap.get(h.security_id);
              return {
                account_id: h.account_id,
                security_name: sec?.name,
                quantity: h.quantity,
                vested_quantity: h.vested_quantity,
                unvested_quantity: h.unvested_quantity,
                institution_value: h.institution_value,
                vested_value: h.vested_value,
                cost_basis: h.cost_basis,
                will_sync: h.vested_quantity != null ? h.vested_quantity : h.quantity,
                reason: h.vested_quantity != null ? 'Using vested_quantity' : 'No vested_quantity - using quantity'
              };
            });

          plaidCrmData.push({
            item_id: item.item_id,
            crm_holdings: crmFromPlaid,
            total_quantity: crmFromPlaid.reduce((s, h) => s + (h.quantity || 0), 0),
            total_will_sync: crmFromPlaid.reduce((s, h) => s + (h.will_sync || 0), 0)
          });
        } catch (plaidErr) {
          plaidCrmData.push({
            item_id: item.item_id,
            error: plaidErr.message
          });
        }
      }
    }

    return NextResponse.json({
      database: {
        crm_holdings: crmHoldings,
        total_shares: crmHoldings?.reduce((sum, h) => sum + parseFloat(h.shares || 0), 0)
      },
      plaid_raw: plaidCrmData,
      plaid_items_count: items?.length || 0,
      analysis: {
        db_shows: crmHoldings?.reduce((sum, h) => sum + parseFloat(h.shares || 0), 0),
        plaid_will_sync: plaidCrmData.reduce((s, p) => s + (p.total_will_sync || 0), 0)
      }
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Exception',
      message: err.message,
      stack: err.stack
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



