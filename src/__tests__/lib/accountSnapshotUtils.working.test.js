/**
 * Tests for Account Snapshot functionality
 * These tests verify that account snapshots are created correctly when accounts are added
 */

// Mock the Supabase client at the module level
const mockFromChain = {
  insert: jest.fn(() => ({
    select: jest.fn(() => Promise.resolve({ 
      data: [
        {
          id: 'snapshot-123',
          account_id: 'acc-123',
          available_balance: 1000.50,
          current_balance: 1000.50,
          limit_balance: null,
          currency_code: 'USD',
          recorded_at: '2024-01-08T12:00:00.000Z'
        }
      ], 
      error: null 
    }))
  }))
}

const mockSupabaseClient = {
  from: jest.fn(() => mockFromChain)
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

// Import after mocking
const { createAccountSnapshots, createAccountSnapshot } = require('../../lib/accountSnapshotUtils')

const mockAccounts = [
  {
    account_id: 'plaid-acc-123',
    name: 'Test Checking Account',
    balances: {
      available: 1000.50,
      current: 1000.50,
      limit: null,
      iso_currency_code: 'USD'
    }
  }
]

const mockAccountIds = ['acc-123']

describe('Account Snapshot Creation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console methods to avoid noise in test output
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    console.log.mockRestore()
    console.error.mockRestore()
  })

  describe('createAccountSnapshots', () => {
    test('should create account snapshots successfully', async () => {
      const result = await createAccountSnapshots(mockAccounts, mockAccountIds)

      // Verify the function succeeded
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      // Verify Supabase methods were called correctly
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('account_snapshots')
      expect(mockFromChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          account_id: 'acc-123',
          available_balance: 1000.50,
          current_balance: 1000.50,
          limit_balance: null,
          currency_code: 'USD',
          recorded_at: expect.any(String)
        })
      ])
    })

    test('should handle missing balance data gracefully', async () => {
      const accountsWithoutBalances = [
        {
          account_id: 'plaid-acc-123',
          name: 'Test Account'
          // No balances property
        }
      ]

      const result = await createAccountSnapshots(accountsWithoutBalances, ['acc-123'])

      expect(result.success).toBe(true)
      expect(mockFromChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          account_id: 'acc-123',
          available_balance: null,
          current_balance: null,
          limit_balance: null,
          currency_code: 'USD'
        })
      ])
    })

    test('should default to USD when currency is not provided', async () => {
      const accountsWithoutCurrency = [
        {
          account_id: 'plaid-acc-123',
          name: 'Test Account',
          balances: {
            available: 100.00,
            current: 100.00
            // No iso_currency_code
          }
        }
      ]

      const result = await createAccountSnapshots(accountsWithoutCurrency, ['acc-123'])

      expect(result.success).toBe(true)
      expect(mockFromChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          currency_code: 'USD'
        })
      ])
    })

    test('should return error when arrays have different lengths', async () => {
      const result = await createAccountSnapshots(mockAccounts, ['acc-123', 'acc-456'])

      expect(result.success).toBe(false)
      expect(result.error).toContain('same length')
    })
  })

  describe('Integration Test Scenario', () => {
    test('should demonstrate complete workflow for account snapshot creation', async () => {
      // Scenario: A user connects a new bank account through Plaid
      const plaidAccountData = {
        account_id: 'plaid_account_xyz',
        name: 'My Checking Account',
        mask: '4321',
        type: 'depository',
        subtype: 'checking',
        balances: {
          available: 2500.75,
          current: 2500.75,
          limit: null,
          iso_currency_code: 'USD'
        }
      }

      const databaseAccountId = 'db_account_123'

      // When: The account snapshot is created
      const result = await createAccountSnapshots([plaidAccountData], [databaseAccountId])

      // Then: The snapshot should be successfully created with correct data
      expect(result.success).toBe(true)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('account_snapshots')
      expect(mockFromChain.insert).toHaveBeenCalledWith([{
        account_id: databaseAccountId,
        available_balance: 2500.75,
        current_balance: 2500.75,
        limit_balance: null,
        currency_code: 'USD',
        recorded_at: expect.any(String)
      }])

      // Verify the recorded timestamp is recent (within last minute)
      const insertCall = mockFromChain.insert.mock.calls[0][0][0]
      const recordedAt = new Date(insertCall.recorded_at)
      const now = new Date()
      const timeDiff = Math.abs(now - recordedAt)
      expect(timeDiff).toBeLessThan(60000) // Less than 1 minute
    })
  })
})
