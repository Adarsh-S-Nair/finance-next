import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getInvestmentsHoldings } from '../../../../lib/plaidClient';

// Dump RAW Plaid response with no processing
// This helps us see exactly what E*TRADE is returning
export async function GET() {
  try {
    // Get all plaid items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, access_token');

    if (itemsError || !items) {
      return Response.json({ error: 'Failed to get plaid items', details: itemsError });
    }

    const results = [];

    for (const item of items) {
      try {
        // Get RAW response from Plaid - no processing
        const rawResponse = await getInvestmentsHoldings(item.access_token);

        // Find CRM holdings in the raw data
        const crmSecurityIds = (rawResponse.securities || [])
          .filter(s => s.ticker_symbol?.toUpperCase() === 'CRM')
          .map(s => s.security_id);

        const crmHoldings = (rawResponse.holdings || [])
          .filter(h => crmSecurityIds.includes(h.security_id));

        const crmSecurities = (rawResponse.securities || [])
          .filter(s => s.ticker_symbol?.toUpperCase() === 'CRM');

        results.push({
          item_id: item.item_id,
          accounts: rawResponse.accounts,
          crm_securities_raw: crmSecurities,
          crm_holdings_raw: crmHoldings,
          all_holdings_count: rawResponse.holdings?.length || 0,
          all_securities_count: rawResponse.securities?.length || 0
        });
      } catch (err) {
        results.push({
          item_id: item.item_id,
          error: err.message
        });
      }
    }

    return Response.json({ results }, { status: 200 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
