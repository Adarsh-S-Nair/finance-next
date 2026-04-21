import { createLinkToken } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { canAccess, getLimit, getPlaidProducts } from '../../../../lib/tierConfig';

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

    // Fetch subscription tier
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    const subscriptionTier = userProfile?.subscription_tier || 'free';

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
      // For update mode, request the additional products (default to investments for upgrade flow)
      const products = additionalProducts || ['investments'];
      const linkTokenResponse = await createLinkToken(userId, products, null, accessToken);
      return Response.json({
        link_token: linkTokenResponse.link_token,
        expiration: linkTokenResponse.expiration,
        updateMode: true,
        plaidItemId,
      });
    }

    // Normal Mode: enforce connection limits per tier
    const connectionLimit = getLimit(subscriptionTier, 'connections');
    if (connectionLimit !== 'unlimited') {
      const { data: existingItems, error: itemsError } = await supabaseAdmin
        .from('plaid_items')
        .select('id')
        .eq('user_id', userId);

      if (!itemsError && existingItems && existingItems.length >= connectionLimit) {
        return Response.json(
          { error: 'connection_limit' },
          { status: 403 }
        );
      }
    }

    // Determine Plaid products based on tier
    const products = getPlaidProducts(subscriptionTier);
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
