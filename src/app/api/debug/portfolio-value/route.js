import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getInvestmentsHoldings } from '../../../../lib/plaidClient';

// GET: Query CRM holdings - shows RAW Plaid response for debugging
export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'No admin client' });
    }

    // Query CRM holdings from database
    const { data: crmHoldings } = await supabaseAdmin
      .from('holdings')
      .select('id, ticker, shares, avg_cost, asset_type, portfolio_id')
      .ilike('ticker', 'CRM');

    // Get plaid items with access tokens
    const { data: items } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, access_token');

    let plaidCrmData = [];
    if (items && items.length > 0) {
      for (const item of items) {
        try {
          const holdingsResponse = await getInvestmentsHoldings(item.access_token);
          const { holdings, securities, accounts } = holdingsResponse;

          // Create security map
          const securityMap = new Map();
          (securities || []).forEach(s => securityMap.set(s.security_id, s));

          // Create account map
          const accountMap = new Map();
          (accounts || []).forEach(a => accountMap.set(a.account_id, a));

          // Find CRM security IDs
          const crmSecurityIds = (securities || [])
            .filter(s => s.ticker_symbol?.toUpperCase() === 'CRM')
            .map(s => s.security_id);

          // Get RAW CRM holdings exactly as Plaid returns them
          const rawCrmHoldings = (holdings || [])
            .filter(h => crmSecurityIds.includes(h.security_id));

          // Also get the CRM security info
          const crmSecurities = (securities || [])
            .filter(s => s.ticker_symbol?.toUpperCase() === 'CRM');

          plaidCrmData.push({
            item_id: item.item_id,
            accounts: (accounts || []).map(a => ({
              account_id: a.account_id,
              name: a.name,
              type: a.type,
              subtype: a.subtype,
              mask: a.mask
            })),
            // THE RAW HOLDINGS - exactly as Plaid returns, no modifications
            raw_crm_holdings: rawCrmHoldings,
            raw_crm_securities: crmSecurities,
            // Summary
            total_raw_quantity: rawCrmHoldings.reduce((s, h) => s + (h.quantity || 0), 0),
            holdings_count: rawCrmHoldings.length
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
      plaid_raw: plaidCrmData
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Exception',
      message: err.message,
      stack: err.stack
    });
  }
}

// POST: Log portfolio valuation details
export async function POST(request) {
  try {
    const body = await request.json();
    const { portfolioId, uiTotal, cash, holdingsValue, holdings = [] } = body || {};

    console.log(
      `[Debug] Portfolio value: portfolioId=${portfolioId}, uiTotal=${uiTotal}, cash=${cash}, holdingsValue=${holdingsValue}`
    );

    if (holdings.length > 0) {
      console.log(`[Debug] Holdings breakdown (${portfolioId}):`);
      holdings.forEach((h) => {
        console.log(
          `  ${h.ticker}: price=${h.price} x shares=${h.shares} = value=${h.marketValue.toFixed(2)}${h.fromQuote ? '' : ' (avg_cost)'}`
        );
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Debug] Error logging portfolio value breakdown', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
