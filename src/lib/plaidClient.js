import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Environment configuration
export const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
export const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
export const PLAID_SECRET = process.env.PLAID_SECRET;

const globalForPlaid = global;

// Lazy initialization of Plaid client
let plaidClient = globalForPlaid.plaidClient || null;

function getPlaidClient() {
  if (!plaidClient) {
    // Validate required environment variables
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error('Missing required Plaid environment variables: PLAID_CLIENT_ID and PLAID_SECRET');
    }

    // Initialize Plaid client configuration
    const configuration = new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    });

    // Create Plaid client instance
    plaidClient = new PlaidApi(configuration);
    if (process.env.NODE_ENV !== 'production') {
      globalForPlaid.plaidClient = plaidClient;
    }
  }

  return plaidClient;
}

export { getPlaidClient };

// Helper function to create link token
// If accessToken is provided, creates a Link token in update mode for additional consent
export async function createLinkToken(userId, products = ['transactions'], accountFilters = null, accessToken = null) {
  try {
    // Check environment variables first
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error('Missing required Plaid environment variables: PLAID_CLIENT_ID and PLAID_SECRET');
    }

    const client = getPlaidClient();
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Finance Next',
      country_codes: ['US'],
      language: 'en',
      webhook: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook` : undefined,
    };

    // Update mode: use access_token instead of products
    // This allows requesting additional product consent without re-linking
    if (accessToken) {
      request.access_token = accessToken;
      // When in update mode with access_token, we can specify additional products
      // that weren't originally consented to
      if (products && products.length > 0) {
        request.additional_consented_products = products;
      }
    } else {
      // Normal mode: specify products for new link
      request.products = products;
    }

    // Add account filters if provided
    if (accountFilters) {
      request.account_filters = accountFilters;
    }

    const response = await client.linkTokenCreate(request);
    return response.data;
  } catch (error) {
    console.error('Error creating link token:', error);

    // Provide more specific error messages
    if (error.response?.data) {
      console.error('Plaid API Error Details:', error.response.data);
      throw new Error(`Plaid API Error: ${error.response.data.error_message || error.response.data.error_code || 'Unknown error'}`);
    }

    throw error;
  }
}

// Helper function to exchange public token for access token
export async function exchangePublicToken(publicToken) {
  try {
    const client = getPlaidClient();
    const request = {
      public_token: publicToken,
    };

    const response = await client.itemPublicTokenExchange(request);
    return response.data;
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw error;
  }
}

// Helper function to get accounts
export async function getAccounts(accessToken) {
  try {
    const client = getPlaidClient();
    const request = {
      access_token: accessToken,
    };

    const response = await client.accountsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw error;
  }
}

// Helper function to get institution info
export async function getInstitution(institutionId) {
  try {
    const client = getPlaidClient();
    const request = {
      institution_id: institutionId,
      country_codes: ['US'],
    };

    const response = await client.institutionsGetById(request);
    return response.data.institution;
  } catch (error) {
    console.error('Error getting institution:', error);

    // Provide more specific error messages
    if (error.response?.data) {
      console.error('Plaid Institution API Error Details:', error.response.data);
      throw new Error(`Institution Error: ${error.response.data.error_message || error.response.data.error_code || 'Unknown error'}`);
    }

    throw error;
  }
}

// Helper function to get transactions
export async function getTransactions(accessToken, startDate, endDate, accountIds = null) {
  try {
    const client = getPlaidClient();
    const request = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      ...(accountIds && { account_ids: accountIds }),
    };

    const response = await client.transactionsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
}

// Helper function to sync transactions using cursor-based pagination
export async function syncTransactions(accessToken, cursor = null) {
  try {
    const client = getPlaidClient();

    // Handle cursor according to Plaid docs: empty string for initial sync, omit for subsequent
    let requestCursor = cursor;
    if (cursor === null || cursor === undefined || cursor.trim() === '') {
      requestCursor = ''; // Empty string for initial sync
    }

    const request = {
      access_token: accessToken,
      cursor: requestCursor,
      count: 250, // Use same count as trading-api
    };

    console.log(`[PLAID SYNC] Request details:`, {
      access_token: accessToken ? `${accessToken.substring(0, 20)}...` : 'None',
      cursor: requestCursor,
      count: request.count
    });

    const response = await client.transactionsSync(request);

    console.log(`[PLAID SYNC] Response details:`, {
      has_more: response.data.has_more,
      next_cursor: response.data.next_cursor,
      added_count: response.data.added?.length || 0,
      modified_count: response.data.modified?.length || 0,
      removed_count: response.data.removed?.length || 0
    });

    return response.data;
  } catch (error) {
    console.error('Error syncing transactions:', error);
    throw error;
  }
}

// Helper function to get investment holdings
export async function getInvestmentsHoldings(accessToken) {
  try {
    const client = getPlaidClient();
    const request = {
      access_token: accessToken,
    };

    const response = await client.investmentsHoldingsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error getting investment holdings:', error);
    throw error;
  }
}

// Helper function to get investment transactions
export async function getInvestmentTransactions(accessToken, startDate, endDate, accountIds = null, options = {}) {
  try {
    const client = getPlaidClient();
    const request = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        ...(accountIds && { account_ids: accountIds }),
        ...options,
      },
    };

    const response = await client.investmentsTransactionsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error getting investment transactions:', error);
    throw error;
  }
}

// Helper function to remove a Plaid item
export async function removeItem(accessToken) {
  try {
    const client = getPlaidClient();
    const request = {
      access_token: accessToken,
    };

    const response = await client.itemRemove(request);
    return response.data;
  } catch (error) {
    console.error('Error removing Plaid item:', error);
    throw error;
  }
}