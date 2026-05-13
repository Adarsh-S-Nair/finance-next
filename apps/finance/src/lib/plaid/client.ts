import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { BRAND } from '../../config/brand';

// Plaid environment: 'sandbox' | 'development' | 'production'.
// Never defaulted to 'sandbox' silently in prod — the platform env must
// set this explicitly.
export const PLAID_ENV: string = process.env.PLAID_ENV || 'sandbox';
export const PLAID_CLIENT_ID: string | undefined = process.env.PLAID_CLIENT_ID;
export const PLAID_SECRET: string | undefined = process.env.PLAID_SECRET;

const globalForPlaid = global as typeof globalThis & {
  plaidClient?: PlaidApi | null;
};

let plaidClient: PlaidApi | null = globalForPlaid.plaidClient || null;

export function getPlaidClient(): PlaidApi {
  if (!plaidClient) {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error(
        'Missing required Plaid environment variables: PLAID_CLIENT_ID and PLAID_SECRET'
      );
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments[PLAID_ENV],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    });

    plaidClient = new PlaidApi(configuration);
    if (process.env.NODE_ENV !== 'production') {
      globalForPlaid.plaidClient = plaidClient;
    }
  }

  return plaidClient;
}

interface PlaidErrorWithResponse {
  response?: { data?: { error_code?: string; error_message?: string } };
  message?: string;
}

interface LinkTokenRequestPayload {
  user: { client_user_id: string };
  client_name: string;
  country_codes: string[];
  language: string;
  webhook?: string;
  redirect_uri?: string;
  access_token?: string;
  additional_consented_products?: string[];
  products?: string[];
  account_filters?: unknown;
}

/**
 * Helper function to create link token.
 * If accessToken is provided, creates a Link token in update mode for additional consent.
 */
export async function createLinkToken(
  userId: string,
  products: string[] = ['transactions'],
  accountFilters: unknown = null,
  accessToken: string | null = null
): Promise<Record<string, unknown>> {
  try {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error(
        'Missing required Plaid environment variables: PLAID_CLIENT_ID and PLAID_SECRET'
      );
    }

    const client = getPlaidClient();
    const request: LinkTokenRequestPayload = {
      user: { client_user_id: userId },
      client_name: BRAND.plaidClientName,
      country_codes: ['US'],
      language: 'en',
      webhook: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`
        : undefined,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/oauth-return`
        : undefined,
    };

    if (accessToken) {
      request.access_token = accessToken;
      if (products && products.length > 0) {
        request.additional_consented_products = products;
      }
    } else {
      request.products = products;
    }

    if (accountFilters) {
      request.account_filters = accountFilters;
    }

    const response = await client.linkTokenCreate(request as Parameters<typeof client.linkTokenCreate>[0]);
    return response.data as unknown as Record<string, unknown>;
  } catch (error) {
    const err = error as PlaidErrorWithResponse;
    console.error('Error creating link token:', error);

    if (err.response?.data) {
      console.error('Plaid API Error Details:', err.response.data);
      throw new Error(
        `Plaid API Error: ${err.response.data.error_message || err.response.data.error_code || 'Unknown error'}`
      );
    }

    throw error;
  }
}

export async function exchangePublicToken(
  publicToken: string
): Promise<Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const response = await client.itemPublicTokenExchange({ public_token: publicToken });
    return response.data as unknown as Record<string, unknown>;
  } catch (error) {
    console.error('Error exchanging public token:', error);
    throw error;
  }
}

export async function getAccounts(
  accessToken: string
): Promise<{ accounts?: Array<Record<string, unknown>> } & Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const response = await client.accountsGet({ access_token: accessToken });
    return response.data as unknown as { accounts?: Array<Record<string, unknown>> } & Record<
      string,
      unknown
    >;
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw error;
  }
}

export async function getInstitution(
  institutionId: string
): Promise<Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const response = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: ['US' as Parameters<typeof client.institutionsGetById>[0]['country_codes'][number]],
      options: { include_optional_metadata: true },
    });
    return response.data.institution as unknown as Record<string, unknown>;
  } catch (error) {
    const err = error as PlaidErrorWithResponse;
    console.error('Error getting institution:', error);

    if (err.response?.data) {
      console.error('Plaid Institution API Error Details:', err.response.data);
      throw new Error(
        `Institution Error: ${err.response.data.error_message || err.response.data.error_code || 'Unknown error'}`
      );
    }

    throw error;
  }
}

// /transactions/get max page size per Plaid docs. We page through with
// offset until we've collected response.total_transactions; without
// this, callers with >100 transactions in a window silently lose
// everything past page 1 (the SDK's default count is 100).
const PLAID_TRANSACTIONS_GET_PAGE_SIZE = 500;
// Hard cap on total rows we'll page through, defense-in-depth against
// runaway loops if total_transactions is malformed.
const PLAID_TRANSACTIONS_GET_MAX = 10_000;

export async function getTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
  accountIds: string[] | null = null
): Promise<{ transactions?: Array<Record<string, unknown>> } & Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const collected: Array<Record<string, unknown>> = [];
    let total = Infinity;
    let firstPageData: Record<string, unknown> | null = null;

    while (collected.length < total && collected.length < PLAID_TRANSACTIONS_GET_MAX) {
      const request = {
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          include_personal_finance_category: true,
          personal_finance_category_version: 'v2',
          count: PLAID_TRANSACTIONS_GET_PAGE_SIZE,
          offset: collected.length,
        },
        ...(accountIds && { account_ids: accountIds }),
      };
      const response = await client.transactionsGet(
        request as Parameters<typeof client.transactionsGet>[0],
      );
      const data = response.data as unknown as {
        transactions?: Array<Record<string, unknown>>;
        total_transactions?: number;
      } & Record<string, unknown>;
      if (!firstPageData) firstPageData = data;
      const page = data.transactions ?? [];
      collected.push(...page);
      if (typeof data.total_transactions === 'number') {
        total = data.total_transactions;
      }
      // Defensive break: if a page returns empty, Plaid has nothing
      // more for us regardless of what total_transactions said.
      if (page.length === 0) break;
    }

    return {
      ...(firstPageData ?? {}),
      transactions: collected,
    };
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
}

export async function syncTransactions(
  accessToken: string,
  cursor: string | null = null
): Promise<{
  added?: Array<Record<string, unknown>>;
  modified?: Array<Record<string, unknown>>;
  removed?: Array<Record<string, unknown>>;
  next_cursor?: string | null;
  has_more?: boolean;
} & Record<string, unknown>> {
  try {
    const client = getPlaidClient();

    let requestCursor = cursor;
    if (cursor === null || cursor === undefined || cursor.trim() === '') {
      requestCursor = '';
    }

    const request = {
      access_token: accessToken,
      cursor: requestCursor,
      count: 250,
      options: {
        include_personal_finance_category: true,
        personal_finance_category_version: 'v2',
      },
    };

    console.log(`[PLAID SYNC] Request details:`, {
      access_token: accessToken ? `${accessToken.substring(0, 20)}...` : 'None',
      cursor: requestCursor,
      count: request.count,
    });

    const response = await client.transactionsSync(
      request as Parameters<typeof client.transactionsSync>[0]
    );

    console.log(`[PLAID SYNC] Response details:`, {
      has_more: response.data.has_more,
      next_cursor: response.data.next_cursor,
      added_count: response.data.added?.length || 0,
      modified_count: response.data.modified?.length || 0,
      removed_count: response.data.removed?.length || 0,
    });

    return response.data as unknown as {
      added?: Array<Record<string, unknown>>;
      modified?: Array<Record<string, unknown>>;
      removed?: Array<Record<string, unknown>>;
      next_cursor?: string | null;
      has_more?: boolean;
    } & Record<string, unknown>;
  } catch (error) {
    console.error('Error syncing transactions:', error);
    throw error;
  }
}

export async function getInvestmentsHoldings(
  accessToken: string
): Promise<Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const response = await client.investmentsHoldingsGet({ access_token: accessToken });
    return response.data as unknown as Record<string, unknown>;
  } catch (error) {
    console.error('Error getting investment holdings:', error);
    throw error;
  }
}

export async function getInvestmentTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
  accountIds: string[] | null = null,
  options: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
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

    const response = await client.investmentsTransactionsGet(
      request as Parameters<typeof client.investmentsTransactionsGet>[0]
    );
    return response.data as unknown as Record<string, unknown>;
  } catch (error) {
    console.error('Error getting investment transactions:', error);
    throw error;
  }
}

export async function getLiabilities(
  accessToken: string
): Promise<Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const response = await client.liabilitiesGet({ access_token: accessToken });
    return response.data as unknown as Record<string, unknown>;
  } catch (error) {
    console.error('Error getting liabilities:', error);
    throw error;
  }
}

export async function removeItem(accessToken: string): Promise<Record<string, unknown>> {
  try {
    const client = getPlaidClient();
    const response = await client.itemRemove({ access_token: accessToken });
    return response.data as unknown as Record<string, unknown>;
  } catch (error) {
    console.error('Error removing Plaid item:', error);
    throw error;
  }
}
