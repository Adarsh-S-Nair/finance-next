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

    // Determine Plaid products and account filters based on account type
    // Default to transactions for backward compatibility
    let products = ['transactions'];
    let accountFilters = null;
    
    if (accountType) {
      // Map account type to Plaid products and account filters
      // Account filters restrict which account types are shown in Plaid Link
      if (accountType === 'investment') {
        products = ['investments'];
        // Only show investment accounts when user selects brokerage/investment
        accountFilters = {
          investment: {
            account_subtypes: ['all']
          }
        };
      } else if (accountType === 'credit_card') {
        products = ['transactions'];
        // Only show credit accounts when user selects credit card
        accountFilters = {
          credit: {
            account_subtypes: ['credit card']
          }
        };
      } else if (accountType === 'checking_savings') {
        products = ['transactions'];
        // Only show depository accounts when user selects checking/savings
        accountFilters = {
          depository: {
            account_subtypes: ['checking', 'savings']
          }
        };
      } else {
        // Default: show all account types for transactions
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
