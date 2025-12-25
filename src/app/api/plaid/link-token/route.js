import { createLinkToken } from '../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { userId, accountType } = await request.json();

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

    // Determine Plaid products based on account type
    // Default to transactions for backward compatibility
    let products = ['transactions'];
    
    if (accountType) {
      // Map account type to Plaid products
      if (accountType === 'investment') {
        products = ['investments'];
      } else {
        // checking_savings and credit_card both use transactions product
        products = ['transactions'];
      }
    }

    // Create link token with appropriate product
    const linkTokenResponse = await createLinkToken(userId, products);

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
