import { createLinkToken } from '../../../../lib/plaid/client';
import { decryptPlaidToken } from '../../../../lib/crypto/plaidTokens';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { getLimit, getPlaidProducts } from '../../../../lib/tierConfig';

type Intent = 'bank' | 'loan' | 'investments';

interface RequestBody {
  plaidItemId?: string | null;
  additionalProducts?: string[] | null;
  intent?: Intent | null;
}

// "bank" covers checking, savings, AND credit cards — all of which Plaid
// surfaces through the transactions product. Requesting only transactions keeps
// institution coverage as wide as possible (no-investments banks like Ally
// still show up); credit-card liabilities detail (APR/due date) can be added
// later via update-mode additional_consented_products. Loans are liabilities-
// only (no transactions). Investments is its own product.
const INTENT_PRODUCTS: Record<Intent, string[]> = {
  bank: ['transactions'],
  loan: ['liabilities'],
  investments: ['investments'],
};

export const POST = withAuth('plaid:link-token', async (request, userId) => {
  const { plaidItemId, additionalProducts, intent } = (await request.json()) as RequestBody;

  // Verify user exists
  const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
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
      return Response.json({ error: 'Plaid item not found' }, { status: 404 });
    }
    const accessToken = decryptPlaidToken(plaidItem.access_token);
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

    if (
      !itemsError &&
      existingItems &&
      typeof connectionLimit === 'number' &&
      existingItems.length >= connectionLimit
    ) {
      return Response.json({ error: 'connection_limit' }, { status: 403 });
    }
  }

  // Determine Plaid products: scope by user intent (banking vs investments) when
  // provided, then intersect with what the user's tier allows. Falling back to
  // the full tier bundle means institutions like Fidelity (investments-only)
  // and Ally (no investments) get filtered out by Plaid — the intent picker
  // exists to avoid exactly that.
  const tierProducts = new Set(getPlaidProducts(subscriptionTier));
  let products: string[];
  if (intent && INTENT_PRODUCTS[intent]) {
    products = INTENT_PRODUCTS[intent].filter((p) => tierProducts.has(p));
    if (products.length === 0) {
      return Response.json({ error: 'tier_required' }, { status: 403 });
    }
  } else {
    products = getPlaidProducts(subscriptionTier);
  }
  const linkTokenResponse = await createLinkToken(userId, products, null);
  return Response.json({
    link_token: linkTokenResponse.link_token,
    expiration: linkTokenResponse.expiration,
  });
});
