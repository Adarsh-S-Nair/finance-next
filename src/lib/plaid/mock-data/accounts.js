/**
 * Mock Plaid account fixture data
 * Used by mock-client.js to return realistic account responses
 */

/**
 * Returns mock accounts for the "power user" scenario —
 * multiple account types with realistic balances.
 */
export const MOCK_ACCOUNTS_POWER_USER = [
  {
    account_id: 'mock_acc_checking_001',
    balances: {
      available: 4821.33,
      current: 4821.33,
      iso_currency_code: 'USD',
      limit: null,
      unofficial_currency_code: null,
    },
    mask: '4242',
    name: 'Chase Total Checking',
    official_name: 'CHASE TOTAL CHECKING',
    subtype: 'checking',
    type: 'depository',
    persistent_account_id: 'mock_persist_checking_001',
  },
  {
    account_id: 'mock_acc_savings_001',
    balances: {
      available: 18340.00,
      current: 18340.00,
      iso_currency_code: 'USD',
      limit: null,
      unofficial_currency_code: null,
    },
    mask: '7891',
    name: 'Chase Savings',
    official_name: 'CHASE SAVINGS',
    subtype: 'savings',
    type: 'depository',
    persistent_account_id: 'mock_persist_savings_001',
  },
  {
    account_id: 'mock_acc_credit_001',
    balances: {
      available: 8200.00,
      current: 1800.00,
      iso_currency_code: 'USD',
      limit: 10000.00,
      unofficial_currency_code: null,
    },
    mask: '3337',
    name: 'Chase Sapphire Preferred',
    official_name: 'CHASE SAPPHIRE PREFERRED CARD',
    subtype: 'credit card',
    type: 'credit',
    persistent_account_id: 'mock_persist_credit_001',
  },
];

/**
 * Investment account for linking investment data.
 */
export const MOCK_ACCOUNTS_INVESTMENT = [
  {
    account_id: 'mock_acc_brokerage_001',
    balances: {
      available: null,
      current: 87432.10,
      iso_currency_code: 'USD',
      limit: null,
      unofficial_currency_code: null,
    },
    mask: '5511',
    name: 'Schwab Brokerage',
    official_name: 'CHARLES SCHWAB BROKERAGE ACCOUNT',
    subtype: 'brokerage',
    type: 'investment',
    persistent_account_id: 'mock_persist_brokerage_001',
  },
  {
    account_id: 'mock_acc_ira_001',
    balances: {
      available: null,
      current: 43211.75,
      iso_currency_code: 'USD',
      limit: null,
      unofficial_currency_code: null,
    },
    mask: '9902',
    name: 'Schwab Roth IRA',
    official_name: 'CHARLES SCHWAB ROTH IRA',
    subtype: 'roth',
    type: 'investment',
    persistent_account_id: 'mock_persist_ira_001',
  },
];

/**
 * All accounts combined (power user scenario).
 */
export const MOCK_ACCOUNTS_ALL = [
  ...MOCK_ACCOUNTS_POWER_USER,
  ...MOCK_ACCOUNTS_INVESTMENT,
];

/**
 * Empty user — no accounts linked.
 */
export const MOCK_ACCOUNTS_EMPTY = [];
