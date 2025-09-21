/**
 * Unit tests for the sync transactions mock service
 * Tests the mock factory functions and utilities
 */

import {
  createMockSyncResponse,
  createMockAccountsResponse,
  createAccountBalanceTestData,
  createMockSupabaseForBalanceUpdates,
  createMockPlaidForSyncWithAccounts,
  validateBalanceUpdates,
  createBalanceUpdateTestScenario
} from './syncTransactionsService'

describe('Sync Transactions Mock Service', () => {
  describe('createMockSyncResponse', () => {
    it('should create a valid sync response with default values', () => {
      const response = createMockSyncResponse()
      
      expect(response).toHaveProperty('added', [])
      expect(response).toHaveProperty('modified', [])
      expect(response).toHaveProperty('removed', [])
      expect(response).toHaveProperty('next_cursor', 'cursor-123')
      expect(response).toHaveProperty('has_more', false)
      expect(response).toHaveProperty('transactions_update_status', 'HISTORICAL_UPDATE_COMPLETE')
      expect(response).toHaveProperty('accounts')
      expect(Array.isArray(response.accounts)).toBe(true)
      expect(response.accounts.length).toBe(1)
    })

    it('should create a sync response with custom values', () => {
      const transactions = [{ id: 'txn-1' }, { id: 'txn-2' }]
      const accounts = [{ id: 'acc-1' }, { id: 'acc-2' }]
      
      const response = createMockSyncResponse({
        transactions,
        accounts,
        nextCursor: 'custom-cursor',
        hasMore: true
      })
      
      expect(response.added).toEqual(transactions)
      expect(response.accounts).toEqual(accounts)
      expect(response.next_cursor).toBe('custom-cursor')
      expect(response.has_more).toBe(true)
    })
  })

  describe('createMockAccountsResponse', () => {
    it('should create a valid accounts response', () => {
      const accounts = [{ id: 'acc-1' }, { id: 'acc-2' }]
      const response = createMockAccountsResponse(accounts)
      
      expect(response).toHaveProperty('accounts', accounts)
      expect(response).toHaveProperty('institution_id', 'ins_123')
      expect(response).toHaveProperty('item')
      expect(response.item).toHaveProperty('institution_id', 'ins_123')
    })

    it('should create accounts response with default accounts', () => {
      const response = createMockAccountsResponse()
      
      expect(response.accounts).toBeDefined()
      expect(Array.isArray(response.accounts)).toBe(true)
      expect(response.accounts.length).toBe(1)
    })
  })

  describe('createAccountBalanceTestData', () => {
    it('should create test data with default values', () => {
      const testData = createAccountBalanceTestData()
      
      expect(testData).toHaveProperty('mockAccounts')
      expect(testData).toHaveProperty('mockPlaidAccounts')
      expect(testData).toHaveProperty('expectedUpdatedBalance')
      
      expect(Array.isArray(testData.mockAccounts)).toBe(true)
      expect(Array.isArray(testData.mockPlaidAccounts)).toBe(true)
      expect(testData.mockAccounts.length).toBe(1)
      expect(testData.mockPlaidAccounts.length).toBe(1)
      expect(testData.expectedUpdatedBalance).toBe(750.75) // 500.00 + 250.75
    })

    it('should create test data with multiple accounts', () => {
      const testData = createAccountBalanceTestData({
        accountCount: 3,
        balanceUpdateAmount: 100.00,
        initialBalance: 200.00
      })
      
      expect(testData.mockAccounts.length).toBe(3)
      expect(testData.mockPlaidAccounts.length).toBe(3)
      expect(testData.expectedUpdatedBalance).toBe(300.00) // 200.00 + 100.00
      
      // Verify account IDs are unique
      const accountIds = testData.mockAccounts.map(acc => acc.account_id)
      const uniqueIds = new Set(accountIds)
      expect(uniqueIds.size).toBe(3)
    })

    it('should create accounts with correct balance structure', () => {
      const testData = createAccountBalanceTestData({
        accountCount: 1,
        balanceUpdateAmount: 50.25,
        initialBalance: 1000.00
      })
      
      const account = testData.mockAccounts[0]
      const plaidAccount = testData.mockPlaidAccounts[0]
      
      // Check initial balance
      expect(account.balances.current).toBe(1000.00)
      expect(account.balances.available).toBe(1000.00)
      expect(account.balances.iso_currency_code).toBe('USD')
      
      // Check updated balance
      expect(plaidAccount.balances.current).toBe(1050.25)
      expect(plaidAccount.balances.available).toBe(1050.25)
      expect(plaidAccount.balances.iso_currency_code).toBe('USD')
    })
  })

  describe('createMockSupabaseForBalanceUpdates', () => {
    it('should create a mock Supabase client with success by default', () => {
      const accounts = [{ id: 'acc-1' }]
      const mockClient = createMockSupabaseForBalanceUpdates({ accounts })
      
      expect(mockClient.from).toBeDefined()
      expect(typeof mockClient.from).toBe('function')
      
      // Test that accounts table returns the provided accounts
      const accountsTable = mockClient.from('accounts')
      expect(accountsTable.select).toBeDefined()
      expect(accountsTable.update).toBeDefined()
    })

    it('should create a mock Supabase client with update failures when specified', () => {
      const accounts = [{ id: 'acc-1' }]
      const mockClient = createMockSupabaseForBalanceUpdates({ 
        accounts, 
        updateSuccess: false 
      })
      
      // The update method should be configured to fail
      const accountsTable = mockClient.from('accounts')
      expect(accountsTable.update).toBeDefined()
    })
  })

  describe('createMockPlaidForSyncWithAccounts', () => {
    it('should create a mock Plaid client with success by default', () => {
      const transactions = [{ id: 'txn-1' }]
      const accounts = [{ id: 'acc-1' }]
      
      const mockClient = createMockPlaidForSyncWithAccounts({
        transactions,
        accounts
      })
      
      expect(mockClient.transactionsSync).toBeDefined()
      expect(mockClient.accountsGet).toBeDefined()
      expect(typeof mockClient.transactionsSync).toBe('function')
      expect(typeof mockClient.accountsGet).toBe('function')
    })

    it('should create a mock Plaid client with sync failures when specified', () => {
      const mockClient = createMockPlaidForSyncWithAccounts({
        syncSuccess: false
      })
      
      expect(mockClient.transactionsSync).toBeDefined()
      // The sync method should be configured to fail
      expect(typeof mockClient.transactionsSync).toBe('function')
    })
  })

  describe('validateBalanceUpdates', () => {
    it('should validate correct balance updates', () => {
      const mockUpdate = jest.fn()
      mockUpdate.mock.calls = [
        [{
          balances: {
            current: 1000.00,
            available: 1000.00,
            iso_currency_code: 'USD'
          }
        }]
      ]

      const mockSupabaseClient = {
        from: jest.fn(() => ({
          update: mockUpdate
        }))
      }

      const expectedUpdates = [
        {
          expectedBalance: 1000.00,
          expectedCurrency: 'USD'
        }
      ]

      const isValid = validateBalanceUpdates(mockSupabaseClient, expectedUpdates)
      expect(isValid).toBe(true)
    })

    it('should detect incorrect balance updates', () => {
      const mockUpdate = jest.fn()
      mockUpdate.mock.calls = [
        [{
          balances: {
            current: 500.00, // Wrong balance
            available: 500.00,
            iso_currency_code: 'USD'
          }
        }]
      ]

      const mockSupabaseClient = {
        from: jest.fn(() => ({
          update: mockUpdate
        }))
      }

      const expectedUpdates = [
        {
          expectedBalance: 1000.00,
          expectedCurrency: 'USD'
        }
      ]

      const isValid = validateBalanceUpdates(mockSupabaseClient, expectedUpdates)
      expect(isValid).toBe(false)
    })
  })

  describe('createBalanceUpdateTestScenario', () => {
    it('should create a complete test scenario with default values', () => {
      const scenario = createBalanceUpdateTestScenario()
      
      expect(scenario).toHaveProperty('mockAccounts')
      expect(scenario).toHaveProperty('mockPlaidAccounts')
      expect(scenario).toHaveProperty('expectedUpdates')
      expect(scenario).toHaveProperty('mockSupabaseClient')
      expect(scenario).toHaveProperty('mockPlaidClient')
      expect(scenario).toHaveProperty('expectedUpdatedCount')
      
      expect(Array.isArray(scenario.mockAccounts)).toBe(true)
      expect(Array.isArray(scenario.mockPlaidAccounts)).toBe(true)
      expect(Array.isArray(scenario.expectedUpdates)).toBe(true)
      expect(scenario.expectedUpdatedCount).toBe(2) // Default accountCount
    })

    it('should create a test scenario with custom parameters', () => {
      const scenario = createBalanceUpdateTestScenario({
        accountCount: 1,
        initialBalance: 500.00,
        balanceChange: 100.00,
        shouldSucceed: false
      })
      
      expect(scenario.mockAccounts.length).toBe(1)
      expect(scenario.mockPlaidAccounts.length).toBe(1)
      expect(scenario.expectedUpdatedCount).toBe(0) // shouldSucceed: false
      expect(scenario.expectedUpdates[0].expectedBalance).toBe(600.00) // 500.00 + 100.00
    })

    it('should create scenario with correct balance calculations', () => {
      const scenario = createBalanceUpdateTestScenario({
        accountCount: 2,
        initialBalance: 1000.00,
        balanceChange: 250.50
      })
      
      // Check that all accounts have the correct updated balance
      scenario.expectedUpdates.forEach(update => {
        expect(update.expectedBalance).toBe(1250.50) // 1000.00 + 250.50
        expect(update.expectedCurrency).toBe('USD')
      })
      
      expect(scenario.expectedUpdatedCount).toBe(2)
    })
  })
})
