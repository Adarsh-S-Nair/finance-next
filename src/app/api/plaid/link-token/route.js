import { createLinkToken } from '../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { userId, accountType, plaidItemId, additionalProducts } = await request.json();

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !user) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update Mode: If plaidItemId is provided, we're requesting additional consent
    let accessToken = null;
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

      accessToken = plaidItem.access_token;

      // For update mode, request transactions product consent
      // (recurring_transactions is an add-on to transactions, not a standalone product)
      const products = additionalProducts || ['transactions'];
      const linkTokenResponse = await createLinkToken(userId, products, null, accessToken);

      return Response.json({
        link_token: linkTokenResponse.link_token,
        expiration: linkTokenResponse.expiration,
        updateMode: true,
      });
    }

    // Normal Mode: Determine Plaid products and account filters based on account type
    let products = ['transactions'];
    let accountFilters = null;

    if (accountType) {
      if (accountType === 'investment') {
        products = ['investments'];
        accountFilters = {
          investment: {
            account_subtypes: ['all']
          }
        };
      } else if (accountType === 'credit_card') {
        products = ['transactions'];
        accountFilters = {
          credit: {
            account_subtypes: ['credit card']
          }
        };
      } else if (accountType === 'checking_savings') {
        products = ['transactions'];
        accountFilters = {
          depository: {
            account_subtypes: ['checking', 'savings']
          }
        };
      } else {
        products = ['transactions'];
      }
    }

    // Create link token with appropriate product and account filters
    const linkTokenResponse = await createLinkToken(userId, products, accountFilters);

    return Response.json({
      link_token: linkTokenResponse.link_token,
      expiration: linkTokenResponse.expiration,
    });
  } catch (error) {
    console.error('Error in link token API:', error);
    return Response.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}
