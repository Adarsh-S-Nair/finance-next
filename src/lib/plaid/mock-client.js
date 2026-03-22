/**
 * Mock Plaid Client
 *
 * Mirrors every method in src/lib/plaid/client.js with realistic fake data.
 * ONLY active when PLAID_ENV === 'mock'. Never runs in production.
 *
 * All responses match Plaid's actual API response shapes so the rest of the
 * app works without modification.
 */

import {
  MOCK_INSTITUTIONS,
  DEFAULT_INSTITUTION_ID,
} from './mock-data/institutions.js';
import {
  MOCK_ACCOUNTS_POWER_USER,
  MOCK_ACCOUNTS_INVESTMENT,
  MOCK_ACCOUNTS_ALL,
} from './mock-data/accounts.js';
import {
  generateTransactions,
  MOCK_TRANSACTIONS_POWER_USER,
  MOCK_TRANSACTIONS_CREDIT,
} from './mock-data/transactions.js';
import {
  MOCK_SECURITIES,
  MOCK_HOLDINGS_BROKERAGE,
  MOCK_HOLDINGS_IRA,
  MOCK_INVESTMENT_TRANSACTIONS,
} from './mock-data/investments.js';

// ------------------------------------------------------------------
// Internal state (in-memory, resets on server restart)
// This simulates Plaid's item state.
// ------------------------------------------------------------------

const _mockState = {
  // Map of access_token → { item_id, institution_id, accounts, cursor }
  items: new Map(),
};

function _makeItemId() {
  return `mock-item-${Math.random().toString(36).slice(2, 10)}`;
}

function _makeAccessToken() {
  return `mock-access-${Math.random().toString(36).slice(2, 18)}`;
}

function _makeLinkToken() {
  return `mock-link-${Math.random().toString(36).slice(2, 18)}`;
}

// ------------------------------------------------------------------
// createLinkToken
// Returns a fake link token. Matches Plaid's LinkTokenCreateResponse shape.
// ------------------------------------------------------------------
export async function createLinkToken(userId, products = ['transactions'], accountFilters = null, accessToken = null) {
  console.log('[MOCK PLAID] createLinkToken called', { userId, products });
  return {
    link_token: _makeLinkToken(),
    expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// exchangePublicToken
// Returns a fake access token + item ID.
// Matches Plaid's ItemPublicTokenExchangeResponse shape.
// ------------------------------------------------------------------
export async function exchangePublicToken(publicToken) {
  console.log('[MOCK PLAID] exchangePublicToken called', { publicToken });

  const accessToken = _makeAccessToken();
  const itemId = _makeItemId();

  // Decide account set based on token prefix (for test script flexibility)
  const isInvestment = publicToken?.includes('invest');
  const accounts = isInvestment ? MOCK_ACCOUNTS_INVESTMENT : MOCK_ACCOUNTS_POWER_USER;

  _mockState.items.set(accessToken, {
    item_id: itemId,
    institution_id: DEFAULT_INSTITUTION_ID,
    accounts,
    cursor: null,
  });

  return {
    access_token: accessToken,
    item_id: itemId,
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// getAccounts
// Returns the accounts associated with this access token.
// Matches Plaid's AccountsGetResponse shape.
// ------------------------------------------------------------------
export async function getAccounts(accessToken) {
  console.log('[MOCK PLAID] getAccounts called');

  const item = _mockState.items.get(accessToken);
  const accounts = item?.accounts ?? MOCK_ACCOUNTS_POWER_USER;
  const itemId = item?.item_id ?? _makeItemId();

  return {
    accounts,
    item: {
      available_products: ['transactions', 'investments'],
      billed_products: ['transactions'],
      consent_expiration_time: null,
      error: null,
      institution_id: item?.institution_id ?? DEFAULT_INSTITUTION_ID,
      item_id: itemId,
      webhook: null,
      update_type: 'background',
    },
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// getInstitution
// Returns fake institution info.
// Matches Plaid's InstitutionsGetByIdResponse.institution shape.
// ------------------------------------------------------------------
export async function getInstitution(institutionId) {
  console.log('[MOCK PLAID] getInstitution called', { institutionId });

  const institution =
    MOCK_INSTITUTIONS[institutionId] ??
    MOCK_INSTITUTIONS[DEFAULT_INSTITUTION_ID];

  return institution;
}

// ------------------------------------------------------------------
// syncTransactions
// Cursor-based transaction sync. First call returns all transactions,
// subsequent calls return empty (no new data).
// Matches Plaid's TransactionsSyncResponse shape.
// ------------------------------------------------------------------
export async function syncTransactions(accessToken, cursor = null) {
  console.log('[MOCK PLAID] syncTransactions called', { cursor: cursor || 'initial' });

  const item = _mockState.items.get(accessToken);
  const itemId = item?.item_id ?? 'mock-item-unknown';

  // Initial sync (empty/null cursor) → return all transactions
  const isInitialSync = !cursor || cursor === '';

  let added = [];
  let modified = [];
  let removed = [];

  if (isInitialSync) {
    const accounts = item?.accounts ?? MOCK_ACCOUNTS_POWER_USER;

    // Generate transactions for each depository/credit account
    for (const account of accounts) {
      if (account.type === 'depository' || account.type === 'credit') {
        const count = account.type === 'credit' ? 30 : 90;
        const seed = account.account_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        added.push(...generateTransactions(account.account_id, count, seed, 90));
      }
    }
  }

  // Next cursor is deterministic based on current timestamp (or fixed for tests)
  const nextCursor = isInitialSync
    ? `mock-cursor-${Date.now()}`
    : cursor; // No new data after first sync

  // Update stored cursor
  if (item) {
    item.cursor = nextCursor;
  }

  return {
    added,
    modified,
    removed,
    has_more: false,
    next_cursor: nextCursor,
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// getTransactions (legacy, non-cursor based)
// Matches Plaid's TransactionsGetResponse shape.
// ------------------------------------------------------------------
export async function getTransactions(accessToken, startDate, endDate, accountIds = null) {
  console.log('[MOCK PLAID] getTransactions called', { startDate, endDate });

  const item = _mockState.items.get(accessToken);
  const accounts = item?.accounts ?? MOCK_ACCOUNTS_POWER_USER;

  let allTransactions = [];
  for (const account of accounts) {
    if (!accountIds || accountIds.includes(account.account_id)) {
      if (account.type === 'depository' || account.type === 'credit') {
        const seed = account.account_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        allTransactions.push(...generateTransactions(account.account_id, 60, seed, 90));
      }
    }
  }

  // Filter by date range
  const filtered = allTransactions.filter(tx => tx.date >= startDate && tx.date <= endDate);

  return {
    accounts,
    transactions: filtered,
    total_transactions: filtered.length,
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// getInvestmentsHoldings
// Returns fake investment holdings.
// Matches Plaid's InvestmentsHoldingsGetResponse shape.
// ------------------------------------------------------------------
export async function getInvestmentsHoldings(accessToken) {
  console.log('[MOCK PLAID] getInvestmentsHoldings called');

  const item = _mockState.items.get(accessToken);
  const accounts = item?.accounts ?? MOCK_ACCOUNTS_INVESTMENT;

  // Only investment accounts
  const investmentAccounts = accounts.filter(a => a.type === 'investment');

  const holdings = [
    ...MOCK_HOLDINGS_BROKERAGE.filter(h =>
      investmentAccounts.some(a => a.account_id === h.account_id)
    ),
    ...MOCK_HOLDINGS_IRA.filter(h =>
      investmentAccounts.some(a => a.account_id === h.account_id)
    ),
  ];

  const securities = Object.values(MOCK_SECURITIES);

  return {
    accounts: investmentAccounts,
    holdings,
    securities,
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// getInvestmentTransactions
// Returns fake investment transactions.
// Matches Plaid's InvestmentsTransactionsGetResponse shape.
// ------------------------------------------------------------------
export async function getInvestmentTransactions(accessToken, startDate, endDate, accountIds = null, options = {}) {
  console.log('[MOCK PLAID] getInvestmentTransactions called', { startDate, endDate });

  const item = _mockState.items.get(accessToken);
  const accounts = item?.accounts ?? MOCK_ACCOUNTS_INVESTMENT;
  const investmentAccounts = accounts.filter(a => a.type === 'investment');

  let transactions = MOCK_INVESTMENT_TRANSACTIONS;

  if (accountIds) {
    transactions = transactions.filter(tx => accountIds.includes(tx.account_id));
  }

  // Filter by date range
  transactions = transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);

  const securities = Object.values(MOCK_SECURITIES);

  return {
    accounts: investmentAccounts,
    investment_transactions: transactions,
    securities,
    total_investment_transactions: transactions.length,
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// removeItem
// No-op success.
// Matches Plaid's ItemRemoveResponse shape.
// ------------------------------------------------------------------
export async function removeItem(accessToken) {
  console.log('[MOCK PLAID] removeItem called');

  _mockState.items.delete(accessToken);

  return {
    request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ------------------------------------------------------------------
// getPlaidClient / getMockPlaidClient
// Returns a mock object that mirrors the PlaidApi interface
// for code that calls client methods directly.
// ------------------------------------------------------------------
export function getMockPlaidClient() {
  return {
    linkTokenCreate: async (request) => {
      const data = await createLinkToken(
        request.user?.client_user_id,
        request.products,
        request.account_filters,
        request.access_token
      );
      return { data };
    },
    itemPublicTokenExchange: async (request) => {
      const data = await exchangePublicToken(request.public_token);
      return { data };
    },
    accountsGet: async (request) => {
      const data = await getAccounts(request.access_token);
      return { data };
    },
    institutionsGetById: async (request) => {
      const institution = await getInstitution(request.institution_id);
      return { data: { institution, request_id: `mock-req-${Math.random().toString(36).slice(2, 10)}` } };
    },
    transactionsSync: async (request) => {
      const data = await syncTransactions(request.access_token, request.cursor);
      return { data };
    },
    transactionsGet: async (request) => {
      const data = await getTransactions(
        request.access_token,
        request.start_date,
        request.end_date,
        request.account_ids
      );
      return { data };
    },
    investmentsHoldingsGet: async (request) => {
      const data = await getInvestmentsHoldings(request.access_token);
      return { data };
    },
    investmentsTransactionsGet: async (request) => {
      const data = await getInvestmentTransactions(
        request.access_token,
        request.start_date,
        request.end_date,
        request.options?.account_ids
      );
      return { data };
    },
    itemRemove: async (request) => {
      const data = await removeItem(request.access_token);
      return { data };
    },
  };
}

// Default export for convenience
export const mockPlaidClient = getMockPlaidClient();
