/**
 * Plaid Client Mock Factory
 * Provides reusable mock implementations for Plaid API operations
 */

// Mock Plaid account data generator
export const createMockPlaidAccount = (overrides = {}) => ({
  account_id: 'plaid-acc-123',
  name: 'Test Checking Account',
  mask: '0000',
  type: 'depository',
  subtype: 'checking',
  balances: {
    available: 1000.50,
    current: 1000.50,
    limit: null,
    iso_currency_code: 'USD'
  },
  ...overrides
})

// Mock Plaid institution data generator
export const createMockPlaidInstitution = (overrides = {}) => ({
  institution_id: 'ins_123',
  name: 'Test Bank',
  logo: 'https://example.com/logo.png',
  primary_color: '#000000',
  url: 'https://testbank.com',
  ...overrides
})

// Mock Plaid API responses
export const mockPlaidResponses = {
  exchangePublicToken: (overrides = {}) => ({
    access_token: 'access-token-123',
    item_id: 'item-123',
    ...overrides
  }),

  getAccounts: (accounts = [createMockPlaidAccount()], overrides = {}) => ({
    accounts,
    institution_id: 'ins_123',
    item: {
      institution_id: 'ins_123'
    },
    ...overrides
  }),

  getInstitution: (institution = createMockPlaidInstitution(), overrides = {}) => ({
    ...institution,
    ...overrides
  }),

  getTransactions: (transactions = [], overrides = {}) => ({
    transactions,
    total_transactions: transactions.length,
    accounts: [createMockPlaidAccount()],
    ...overrides
  }),

  syncTransactions: (transactions = [], accounts = [createMockPlaidAccount()], overrides = {}) => ({
    added: transactions,
    modified: [],
    removed: [],
    next_cursor: 'cursor-123',
    has_more: false,
    transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
    accounts,
    ...overrides
  })
}

// Mock Plaid client factory
export const createMockPlaidClient = (customMethods = {}) => ({
  exchangePublicToken: jest.fn(() => Promise.resolve(mockPlaidResponses.exchangePublicToken())),
  getAccounts: jest.fn(() => Promise.resolve(mockPlaidResponses.getAccounts())),
  getInstitution: jest.fn(() => Promise.resolve(mockPlaidResponses.getInstitution())),
  getTransactions: jest.fn(() => Promise.resolve(mockPlaidResponses.getTransactions())),
  transactionsSync: jest.fn(() => Promise.resolve(mockPlaidResponses.syncTransactions())),
  ...customMethods
})

// Default mock implementations
export const mockExchangePublicToken = jest.fn(() => 
  Promise.resolve(mockPlaidResponses.exchangePublicToken())
)

export const mockGetAccounts = jest.fn(() => 
  Promise.resolve(mockPlaidResponses.getAccounts())
)

export const mockGetInstitution = jest.fn(() => 
  Promise.resolve(mockPlaidResponses.getInstitution())
)

export const mockGetTransactions = jest.fn(() => 
  Promise.resolve(mockPlaidResponses.getTransactions())
)

export const mockSyncTransactions = jest.fn(() => 
  Promise.resolve(mockPlaidResponses.syncTransactions())
)

// Export the main mock
export default {
  exchangePublicToken: mockExchangePublicToken,
  getAccounts: mockGetAccounts,
  getInstitution: mockGetInstitution,
  getTransactions: mockGetTransactions,
  syncTransactions: mockSyncTransactions
}
