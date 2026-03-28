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
  DRIP_TEMPLATES,
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

  // Decide account set + institution based on token content (matches AccountSetupFlow token format: mock-public-<accountType>)
  const isInvestment = publicToken?.includes('invest');
  const isCreditCard = publicToken?.includes('credit_card');
  const isCheckingSavings = publicToken?.includes('checking_savings');

  let accounts;
  let institutionId;
  if (isInvestment) {
    accounts = MOCK_ACCOUNTS_INVESTMENT;
    institutionId = 'ins_mock_schwab';
  } else if (isCreditCard) {
    accounts = MOCK_ACCOUNTS_POWER_USER.filter(a => a.type === 'credit');
    institutionId = DEFAULT_INSTITUTION_ID;
  } else if (isCheckingSavings) {
    accounts = MOCK_ACCOUNTS_POWER_USER.filter(a => a.type === 'depository');
    institutionId = DEFAULT_INSTITUTION_ID;
  } else {
    accounts = MOCK_ACCOUNTS_POWER_USER;
    institutionId = DEFAULT_INSTITUTION_ID;
  }

  _mockState.items.set(accessToken, {
    item_id: itemId,
    institution_id: institutionId,
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
// _seededRandom — simple deterministic PRNG (mirrors the one in transactions.js)
// ------------------------------------------------------------------
function _seededRandom(seed, i) {
  const x = Math.sin(seed + i) * 10000;
  return x - Math.floor(x);
}

// ------------------------------------------------------------------
// _parseCursorTimestamp
// Cursors look like "mock-cursor-<ms>" – extract the ms timestamp.
// Returns null if cursor is not parseable.
// ------------------------------------------------------------------
function _parseCursorTimestamp(cursor) {
  if (!cursor) return null;
  const match = cursor.match(/mock-cursor-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ------------------------------------------------------------------
// _generateDripTransactions
// Generate realistic new transactions for elapsed days since last sync.
// IDs are deterministic per (accountId, date, slot) so re-syncs are idempotent.
// ------------------------------------------------------------------
function _generateDripTransactions(accounts, sinceMs) {
  const added = [];
  const now = Date.now();
  const sinceDate = new Date(sinceMs);
  sinceDate.setHours(0, 0, 0, 0); // start of day
  const nowDate = new Date(now);

  // Iterate over each elapsed day (exclusive of the cursor day, inclusive of today)
  for (let d = new Date(sinceDate); d <= nowDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    // Day-level seed: numeric representation of YYYYMMDD
    const daySeed = parseInt(dateStr.replace(/-/g, ''), 10);

    // Determine how many transactions on this day using weighted distribution
    // 0-1 most common, 3+ rare
    const roll = _seededRandom(daySeed, 0);
    let txCount;
    if (roll < 0.35) {
      txCount = 0;
    } else if (roll < 0.70) {
      txCount = 1;
    } else if (roll < 0.88) {
      txCount = 2;
    } else if (roll < 0.96) {
      txCount = 3;
    } else if (roll < 0.99) {
      txCount = 4;
    } else {
      txCount = 5;
    }

    for (const account of accounts) {
      if (account.type !== 'depository' && account.type !== 'credit') continue;

      // Per-account modifier so different accounts get different transactions
      const accountSeed = account.account_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const effectiveSeed = daySeed + accountSeed;

      for (let slot = 0; slot < txCount; slot++) {
        const templateIdx = Math.floor(_seededRandom(effectiveSeed, slot * 3 + 1) * DRIP_TEMPLATES.length);
        const template = DRIP_TEMPLATES[templateIdx];

        // Slight amount variation
        const variation = 1 + (_seededRandom(effectiveSeed, slot * 3 + 2) - 0.5) * 0.2;
        const baseAmt = Math.abs(template.amount);
        const isCredit = template.amount < 0;
        const amount = parseFloat((baseAmt * variation * (isCredit ? -1 : 1)).toFixed(2));

        // Deterministic transaction ID — safe to re-insert
        const txId = `mock_drip_${account.account_id}_${dateStr}_${slot}`;

        const hour = String(8 + Math.floor(_seededRandom(effectiveSeed, slot + 10) * 13)).padStart(2, '0');
        const minute = String(Math.floor(_seededRandom(effectiveSeed, slot + 20) * 59)).padStart(2, '0');

        added.push({
          account_id: account.account_id,
          transaction_id: txId,
          amount,
          iso_currency_code: 'USD',
          unofficial_currency_code: null,
          category: null,
          category_id: null,
          check_number: null,
          datetime: `${dateStr}T${hour}:${minute}:00Z`,
          authorized_date: dateStr,
          authorized_datetime: `${dateStr}T00:00:00Z`,
          date: dateStr,
          location: template.location || {
            address: null, city: null, region: null, postal_code: null,
            country: null, lat: null, lon: null, store_number: null,
          },
          name: template.merchant_name,
          merchant_name: template.merchant_name,
          merchant_entity_id: `mock_merchant_${templateIdx}`,
          logo_url: template.icon_url,
          website: template.website || null,
          payment_meta: {
            by_order_of: null, payee: null, payer: null, payment_method: null,
            payment_processor: null, ppd_id: null, reason: null, reference_number: null,
          },
          payment_channel: template.payment_channel,
          pending: false,
          pending_transaction_id: null,
          account_owner: null,
          transaction_code: null,
          transaction_type: amount < 0 ? 'special' : 'place',
          personal_finance_category: template.personal_finance_category,
          personal_finance_category_icon_url: template.icon_url,
          counterparties: [
            {
              name: template.merchant_name,
              type: 'merchant',
              logo_url: template.icon_url,
              website: template.website || null,
              entity_id: `mock_entity_${templateIdx}`,
              confidence_level: 'VERY_HIGH',
            },
          ],
        });
      }
    }
  }

  return added;
}

// ------------------------------------------------------------------
// syncTransactions
// Cursor-based transaction sync.
// - Initial sync (null cursor): returns historical transactions for all accounts.
// - Subsequent syncs: generates new transactions for days elapsed since last cursor.
// Matches Plaid's TransactionsSyncResponse shape.
// ------------------------------------------------------------------
export async function syncTransactions(accessToken, cursor = null) {
  console.log('[MOCK PLAID] syncTransactions called', { cursor: cursor || 'initial' });

  const item = _mockState.items.get(accessToken);
  const itemId = item?.item_id ?? 'mock-item-unknown';

  // Initial sync (empty/null cursor) → return all historical transactions
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
  } else {
    // Incremental sync: drip transactions for elapsed days since last cursor
    const sinceMs = _parseCursorTimestamp(cursor);
    if (sinceMs) {
      const accounts = item?.accounts ?? MOCK_ACCOUNTS_POWER_USER;
      added = _generateDripTransactions(accounts, sinceMs);
      console.log(`[MOCK PLAID] Drip: generated ${added.length} new transactions since last sync`);
    }
  }

  // Next cursor always advances to now
  const nextCursor = `mock-cursor-${Date.now()}`;

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
