import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Environment configuration
export const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
export const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
export const PLAID_SECRET = process.env.PLAID_SECRET;

// Lazy initialization of Plaid client
let plaidClient = null;

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
  }
  
  return plaidClient;
}

export { getPlaidClient };

// Helper function to create link token
export async function createLinkToken(userId, products = ['transactions', 'auth']) {
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
      products: products,
      country_codes: ['US'],
      language: 'en',
      webhook: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook` : undefined,
    };

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
    const request = {
      access_token: accessToken,
      cursor: cursor,
      count: 500, // Maximum allowed by Plaid
    };

    const response = await client.transactionsSync(request);
    return response.data;
  } catch (error) {
    console.error('Error syncing transactions:', error);
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