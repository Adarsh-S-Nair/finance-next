import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Initialize Plaid client configuration
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

// Create Plaid client instance
export const plaidClient = new PlaidApi(configuration);

// Environment configuration
export const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
export const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
export const PLAID_SECRET = process.env.PLAID_SECRET;

// Validate required environment variables
if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  throw new Error('Missing required Plaid environment variables: PLAID_CLIENT_ID and PLAID_SECRET');
}

// Helper function to create link token
export async function createLinkToken(userId, products = ['transactions', 'accounts']) {
  try {
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Finance Next',
      products: products,
      country_codes: ['US'],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    return response.data;
  } catch (error) {
    console.error('Error creating link token:', error);
    throw error;
  }
}

// Helper function to exchange public token for access token
export async function exchangePublicToken(publicToken) {
  try {
    const request = {
      public_token: publicToken,
    };

    const response = await plaidClient.itemPublicTokenExchange(request);
    return response.data;
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw error;
  }
}

// Helper function to get accounts
export async function getAccounts(accessToken) {
  try {
    const request = {
      access_token: accessToken,
    };

    const response = await plaidClient.accountsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw error;
  }
}

// Helper function to get institution info
export async function getInstitution(institutionId) {
  try {
    const request = {
      institution_id: institutionId,
      country_codes: ['US'],
    };

    const response = await plaidClient.institutionsGetById(request);
    return response.data.institution;
  } catch (error) {
    console.error('Error getting institution:', error);
    throw error;
  }
}

// Helper function to get transactions
export async function getTransactions(accessToken, startDate, endDate, accountIds = null) {
  try {
    const request = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      ...(accountIds && { account_ids: accountIds }),
    };

    const response = await plaidClient.transactionsGet(request);
    return response.data;
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
}
