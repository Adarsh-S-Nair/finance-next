/**
 * Mock service for sync transactions functionality
 * Provides reusable mock implementations for testing account balance updates
 */

import { 
  createMockPlaidAccount, 
  mockPlaidResponses 
} from './plaidClient'
import { 
  createMockAccount, 
  createMockPlaidItem,
  mockSupabaseResponses 
} from './supabase'

/**
 * Creates a mock sync transactions response with account data
 * @param {Object} options - Configuration options
 * @param {Array} options.transactions - Array of mock transactions
 * @param {Array} options.accounts - Array of mock accounts with updated balances
 * @param {string} options.nextCursor - Next cursor for pagination
 * @param {boolean} options.hasMore - Whether there are more pages
 * @returns {Object} Mock sync response
 */
export const createMockSyncResponse = ({
  transactions = [],
  accounts = [createMockPlaidAccount()],
  nextCursor = 'cursor-123',
  hasMore = false
} = {}) => ({
  added: transactions,
  modified: [],
  removed: [],
  next_cursor: nextCursor,
  has_more: hasMore,
  transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
  accounts
})

/**
 * Creates a mock accounts response with updated balances
 * @param {Array} accounts - Array of mock accounts with balance data
 * @returns {Object} Mock accounts response
 */
export const createMockAccountsResponse = (accounts = [createMockPlaidAccount()]) => ({
  accounts,
  institution_id: 'ins_123',
  item: {
    institution_id: 'ins_123'
  }
})

/**
 * Creates test data for account balance update scenarios
 * @param {Object} options - Configuration options
 * @returns {Object} Test data object
 */
export const createAccountBalanceTestData = ({
  accountCount = 1,
  balanceUpdateAmount = 250.75,
  initialBalance = 500.00
} = {}) => {
  const mockAccounts = []
  const mockPlaidAccounts = []

  for (let i = 0; i < accountCount; i++) {
    const accountId = `plaid-acc-${i + 1}`
    
    mockAccounts.push(
      createMockAccount({
        id: `acc-${i + 1}`,
        account_id: accountId,
        plaid_item_id: 'plaid-item-123',
        balances: {
          available: initialBalance,
          current: initialBalance,
          iso_currency_code: 'USD'
        }
      })
    )

    mockPlaidAccounts.push(
      createMockPlaidAccount({
        account_id: accountId,
        balances: {
          available: initialBalance + balanceUpdateAmount,
          current: initialBalance + balanceUpdateAmount,
          iso_currency_code: 'USD'
        }
      })
    )
  }

  return {
    mockAccounts,
    mockPlaidAccounts,
    expectedUpdatedBalance: initialBalance + balanceUpdateAmount
  }
}

/**
 * Creates a mock Supabase client configured for account balance updates
 * @param {Object} options - Configuration options
 * @param {Array} options.accounts - Mock accounts data
 * @param {boolean} options.updateSuccess - Whether updates should succeed
 * @returns {Object} Mock Supabase client
 */
export const createMockSupabaseForBalanceUpdates = ({
  accounts = [createMockAccount()],
  updateSuccess = true
} = {}) => {
  const mockFromChain = {
    select: jest.fn(() => Promise.resolve(mockSupabaseResponses.success(accounts))),
    insert: jest.fn(() => Promise.resolve(mockSupabaseResponses.success())),
    delete: jest.fn(() => Promise.resolve(mockSupabaseResponses.success())),
    upsert: jest.fn(() => Promise.resolve(mockSupabaseResponses.success())),
    eq: jest.fn(() => mockFromChain),
    single: jest.fn(() => Promise.resolve(mockSupabaseResponses.success(accounts[0] || null))),
    order: jest.fn(() => mockFromChain),
    limit: jest.fn(() => mockFromChain)
  }

  // Configure update method based on success parameter
  if (updateSuccess) {
    mockFromChain.update = jest.fn(() => Promise.resolve(mockSupabaseResponses.success()))
  } else {
    mockFromChain.update = jest.fn(() => Promise.resolve(mockSupabaseResponses.error('Update failed')))
  }

  return {
    from: jest.fn((table) => {
      if (table === 'accounts') {
        return {
          ...mockFromChain,
          select: jest.fn(() => Promise.resolve(mockSupabaseResponses.success(accounts)))
        }
      }
      return mockFromChain
    })
  }
}

/**
 * Creates a mock Plaid client configured for sync transactions with account updates
 * @param {Object} options - Configuration options
 * @param {Array} options.transactions - Mock transactions
 * @param {Array} options.accounts - Mock accounts with balances
 * @param {boolean} options.syncSuccess - Whether sync should succeed
 * @param {boolean} options.accountsSuccess - Whether getAccounts should succeed
 * @returns {Object} Mock Plaid client
 */
export const createMockPlaidForSyncWithAccounts = ({
  transactions = [],
  accounts = [createMockPlaidAccount()],
  syncSuccess = true,
  accountsSuccess = true
} = {}) => {
  const mockClient = {
    transactionsSync: jest.fn(),
    accountsGet: jest.fn()
  }

  // Configure transactionsSync
  if (syncSuccess) {
    mockClient.transactionsSync.mockResolvedValue(
      createMockSyncResponse({ transactions, accounts })
    )
  } else {
    mockClient.transactionsSync.mockRejectedValue(new Error('Sync failed'))
  }

  // Configure accountsGet
  if (accountsSuccess) {
    mockClient.accountsGet.mockResolvedValue(
      createMockAccountsResponse(accounts)
    )
  } else {
    mockClient.accountsGet.mockRejectedValue(new Error('Get accounts failed'))
  }

  return mockClient
}

/**
 * Validates that account balance updates were called correctly
 * @param {Object} mockSupabaseClient - Mock Supabase client
 * @param {Array} expectedUpdates - Array of expected balance updates
 * @returns {boolean} Whether all updates were called correctly
 */
export const validateBalanceUpdates = (mockSupabaseClient, expectedUpdates) => {
  const updateCalls = mockSupabaseClient.from('accounts').update.mock.calls
  
  if (updateCalls.length !== expectedUpdates.length) {
    return false
  }

  return expectedUpdates.every((expectedUpdate, index) => {
    const actualCall = updateCalls[index]
    const actualData = actualCall[0]
    
    return (
      actualData.balances.current === expectedUpdate.expectedBalance &&
      actualData.balances.available === expectedUpdate.expectedBalance &&
      actualData.balances.iso_currency_code === expectedUpdate.expectedCurrency
    )
  })
}

/**
 * Creates a comprehensive test scenario for account balance updates
 * @param {Object} options - Configuration options
 * @returns {Object} Complete test scenario data
 */
export const createBalanceUpdateTestScenario = ({
  accountCount = 2,
  initialBalance = 1000.00,
  balanceChange = 150.25,
  shouldSucceed = true
} = {}) => {
  const testData = createAccountBalanceTestData({
    accountCount,
    balanceUpdateAmount: balanceChange,
    initialBalance
  })

  const expectedUpdates = testData.mockPlaidAccounts.map(account => ({
    expectedBalance: account.balances.current,
    expectedCurrency: account.balances.iso_currency_code
  }))

  const mockSupabaseClient = createMockSupabaseForBalanceUpdates({
    accounts: testData.mockAccounts,
    updateSuccess: shouldSucceed
  })

  const mockPlaidClient = createMockPlaidForSyncWithAccounts({
    accounts: testData.mockPlaidAccounts,
    syncSuccess: true,
    accountsSuccess: true
  })

  return {
    ...testData,
    expectedUpdates,
    mockSupabaseClient,
    mockPlaidClient,
    expectedUpdatedCount: shouldSucceed ? accountCount : 0
  }
}

// Export default mock factory
export default {
  createMockSyncResponse,
  createMockAccountsResponse,
  createAccountBalanceTestData,
  createMockSupabaseForBalanceUpdates,
  createMockPlaidForSyncWithAccounts,
  validateBalanceUpdates,
  createBalanceUpdateTestScenario
}
