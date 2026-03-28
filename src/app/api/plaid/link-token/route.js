import { createLinkToken } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { plaidItemId, additionalProducts } = await request.json();
    // Verify user exists
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !user) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    // Update Mode: If plaidItemId is provided, we're requesting additional consent
    if (plaidItemId) {
      const { data: plaidItem, error: itemError } = await supabaseAdmin
        .from('plaid_items')
        .select('access_token')
        .eq('id', plaidItemId)
        .eq('user_id', userId)
        .single();
      if (itemError || !plaidItem) {
        return Response.json(
          { error: 'Plaid item not found' },
          { status: 404 }
        );
      }
      const accessToken = plaidItem.access_token;
      // For update mode, request transactions product consent
      const products = additionalProducts || ['transactions'];
      const linkTokenResponse = await createLinkToken(userId, products, null, accessToken);
      return Response.json({
        link_token: linkTokenResponse.link_token,
        expiration: linkTokenResponse.expiration,
        updateMode: true,
      });
    }
    // Normal Mode: Always request both transactions and investments products
    // This creates a single Plaid Item that covers all account types at an institution
    const products = ['transactions', 'investments'];
    const linkTokenResponse = await createLinkToken(userId, products, null);
    return Response.json({
      link_token: linkTokenResponse.link_token,
      expiration: linkTokenResponse.expiration,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error in link token API:', error);
    return Response.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}
