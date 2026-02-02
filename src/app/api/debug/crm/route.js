import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// Super simple debug endpoint - just show CRM holdings from database
export async function GET() {
  try {
    // Check admin client
    if (!supabaseAdmin) {
      return Response.json({ error: 'No admin client', env_check: {
        has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        has_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }});
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
        portfolio:portfolios(id, name, type)
      `)
      .ilike('ticker', 'CRM');

    if (holdingsError) {
      return Response.json({
        error: 'Holdings query failed',
        details: holdingsError
      });
    }

    // Also get plaid_items to check what's connected
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, institution_id');

    return Response.json({
      crm_holdings: crmHoldings,
      total_crm_shares: crmHoldings?.reduce((sum, h) => sum + parseFloat(h.shares || 0), 0),
      plaid_items: items,
      plaid_items_error: itemsError
    });
  } catch (err) {
    return Response.json({
      error: 'Exception',
      message: err.message,
      stack: err.stack
    });
  }
}
