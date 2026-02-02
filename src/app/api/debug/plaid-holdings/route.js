import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getInvestmentsHoldings } from '../../../../lib/plaidClient';

// Debug endpoint to see raw Plaid holdings data
// This helps diagnose issues with vested_quantity handling for RSUs
// No auth required - this is a temporary debug endpoint
export async function GET(request) {
  try {
    // Get ALL plaid items (personal app, should be just one user)
    const { data: plaidItems, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, access_token, institution_id, user_id');

    if (itemsError) {
      return Response.json({ error: 'Failed to fetch plaid items' }, { status: 500 });
    }

    const results = [];

    for (const item of plaidItems) {
      try {
        // Get raw holdings from Plaid
        const holdingsResponse = await getInvestmentsHoldings(item.access_token);
        const { accounts, holdings, securities } = holdingsResponse;

        // Create security map for lookup
        const securityMap = new Map();
        if (securities) {
          securities.forEach(s => {
            securityMap.set(s.security_id, s);
          });
        }

        // Map holdings with security info and vested details
        const enrichedHoldings = holdings?.map(h => {
          const security = securityMap.get(h.security_id);
          return {
            account_id: h.account_id,
            security_id: h.security_id,
            ticker: security?.ticker_symbol || 'Unknown',
            security_name: security?.name,
            security_type: security?.type,
            quantity: h.quantity,
            vested_quantity: h.vested_quantity,
            unvested_quantity: h.unvested_quantity,
            institution_value: h.institution_value,
            vested_value: h.vested_value,
            cost_basis: h.cost_basis,
            institution_price: h.institution_price,
            // Analysis
            will_use_quantity: h.vested_quantity != null ? h.vested_quantity : h.quantity,
            reason: h.vested_quantity != null ? 'Using vested_quantity' : 'No vested_quantity, using quantity'
          };
        }) || [];

        // Group by ticker for analysis
        const byTicker = {};
        enrichedHoldings.forEach(h => {
          const ticker = h.ticker?.toUpperCase() || 'Unknown';
          if (!byTicker[ticker]) {
            byTicker[ticker] = {
              holdings: [],
              total_quantity: 0,
              total_will_use: 0
            };
          }
          byTicker[ticker].holdings.push(h);
          byTicker[ticker].total_quantity += h.quantity || 0;
          byTicker[ticker].total_will_use += h.will_use_quantity || 0;
        });

        results.push({
          item_id: item.item_id,
          institution_id: item.institution_id,
          accounts: accounts?.map(a => ({
            account_id: a.account_id,
            name: a.name,
            type: a.type,
            subtype: a.subtype
          })),
          holdings_count: holdings?.length || 0,
          holdings: enrichedHoldings,
          by_ticker: byTicker
        });
      } catch (err) {
        results.push({
          item_id: item.item_id,
          error: err.message
        });
      }
    }

    // Also fetch what's stored in the database for comparison
    const { data: dbPortfolios, error: dbError } = await supabaseAdmin
      .from('portfolios')
      .select(`
        id,
        name,
        type,
        user_id,
        holdings(id, ticker, shares, avg_cost, asset_type)
      `)
      .eq('type', 'plaid_investment');

    // Group database holdings by ticker for easy comparison
    const dbByTicker = {};
    if (dbPortfolios) {
      dbPortfolios.forEach(p => {
        (p.holdings || []).forEach(h => {
          const ticker = h.ticker?.toUpperCase() || 'Unknown';
          if (!dbByTicker[ticker]) {
            dbByTicker[ticker] = {
              holdings: [],
              total_shares: 0
            };
          }
          dbByTicker[ticker].holdings.push({
            portfolio_id: p.id,
            portfolio_name: p.name,
            shares: h.shares,
            avg_cost: h.avg_cost,
            asset_type: h.asset_type
          });
          dbByTicker[ticker].total_shares += parseFloat(h.shares) || 0;
        });
      });
    }

    return Response.json({
      plaid_items_count: plaidItems.length,
      results,
      database: {
        portfolios_count: dbPortfolios?.length || 0,
        portfolios: dbPortfolios?.map(p => ({
          id: p.id,
          name: p.name,
          holdings_count: p.holdings?.length || 0
        })),
        by_ticker: dbByTicker
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
