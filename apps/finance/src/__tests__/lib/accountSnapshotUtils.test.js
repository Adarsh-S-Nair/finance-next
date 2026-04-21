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
const { 
  createAccountSnapshots, 
  createAccountSnapshot,
  getMostRecentAccountSnapshot,
  shouldCreateAccountSnapshot,
  createAccountSnapshotConditional
} = require('../../lib/accountSnapshotUtils')

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

  describe('Conditional Account Snapshot Creation Tests', () => {
    let mockSelectChain
    let mockSingleChain

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks()
      
      // Create mock chains for select operations
      mockSelectChain = {
        eq: jest.fn(() => mockSelectChain),
        order: jest.fn(() => mockSelectChain),
        limit: jest.fn(() => mockSelectChain),
        single: jest.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
      }
      
      mockSingleChain = {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ 
              data: { id: 'snapshot-123', account_id: 'acc-123', current_balance: 1000.50 },
              error: null 
            }))
          }))
        }))
      }

      // Update the mock to return different chains based on the method
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'account_snapshots') {
          return {
            select: jest.fn(() => mockSelectChain),
            insert: jest.fn(() => mockSingleChain)
          }
        }
        return mockFromChain
      })
    })

    describe('getMostRecentAccountSnapshot', () => {
      test('should return null when no snapshots exist', async () => {
        const result = await getMostRecentAccountSnapshot('acc-123')
        
        expect(result).toBeNull()
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('account_snapshots')
        expect(mockSelectChain.eq).toHaveBeenCalledWith('account_id', 'acc-123')
        expect(mockSelectChain.order).toHaveBeenCalledWith('recorded_at', { ascending: false })
        expect(mockSelectChain.limit).toHaveBeenCalledWith(1)
        expect(mockSelectChain.single).toHaveBeenCalled()
      })

      test('should return most recent snapshot when one exists', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: '2024-01-08T12:00:00.000Z'
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const result = await getMostRecentAccountSnapshot('acc-123')
        
        expect(result).toEqual(mockSnapshot)
      })

      test('should handle database errors gracefully', async () => {
        mockSelectChain.single.mockResolvedValueOnce({ 
          data: null, 
          error: { code: 'SOME_ERROR', message: 'Database error' } 
        })
        
        const result = await getMostRecentAccountSnapshot('acc-123')
        
        expect(result).toBeNull()
      })
    })

    describe('shouldCreateAccountSnapshot', () => {
      test('should return true when no previous snapshot exists', async () => {
        const account = {
          balances: { current: 1000.50, available: 1000.50 }
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        expect(result.shouldCreate).toBe(true)
        expect(result.reason).toBe('No previous snapshot exists')
      })

      test('should return true when date is different and balance is different', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: '2024-01-07T12:00:00.000Z' // Yesterday
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { current: 1200.75, available: 1200.75 } // Different balance
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        expect(result.shouldCreate).toBe(true)
        expect(result.isDateDifferent).toBe(true)
        expect(result.isBalanceDifferent).toBe(true)
        expect(result.reason).toContain('Date different')
        expect(result.reason).toContain('balance different')
      })

      test('should return false when date is same but balance is different', async () => {
        const today = new Date().toISOString().split('T')[0]
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: `${today}T12:00:00.000Z` // Same date
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { current: 1200.75, available: 1200.75 } // Different balance
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        expect(result.shouldCreate).toBe(false)
        expect(result.isDateDifferent).toBe(false)
        expect(result.isBalanceDifferent).toBe(true)
        expect(result.reason).toContain('Date same: true')
        expect(result.reason).toContain('Balance same: false')
      })

      test('should return false when date is different but balance is same', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: '2024-01-07T12:00:00.000Z' // Yesterday
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { current: 1000.50, available: 1000.50 } // Same balance
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        expect(result.shouldCreate).toBe(false)
        expect(result.isDateDifferent).toBe(true)
        expect(result.isBalanceDifferent).toBe(false)
        expect(result.reason).toContain('Date same: false')
        expect(result.reason).toContain('Balance same: true')
      })

      test('should return false when both date and balance are same', async () => {
        const today = new Date().toISOString().split('T')[0]
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: `${today}T12:00:00.000Z` // Same date
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { current: 1000.50, available: 1000.50 } // Same balance
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        expect(result.shouldCreate).toBe(false)
        expect(result.isDateDifferent).toBe(false)
        expect(result.isBalanceDifferent).toBe(false)
        expect(result.reason).toContain('Date same: true')
        expect(result.reason).toContain('Balance same: true')
      })

      test('should handle null balances gracefully', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: null,
          recorded_at: '2024-01-07T12:00:00.000Z'
        }
        
        // Reset the mock for this specific test
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { current: null, available: null }
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        // The logic requires BOTH date AND balance to be different
        // null === null is true, so isBalanceDifferent should be false
        // Since both conditions must be met, shouldCreate should be false
        expect(result.shouldCreate).toBe(false) // Both conditions must be met
        expect(result.isDateDifferent).toBe(true)
        expect(result.isBalanceDifferent).toBe(false) // null === null
      })
    })

    describe('createAccountSnapshotConditional', () => {
      test('should create snapshot when conditions are met', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: '2024-01-07T12:00:00.000Z'
        }
        
        // Mock the select chain for getting most recent snapshot
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        // Mock the insert chain for creating new snapshot
        const mockInsertResult = {
          id: 'snapshot-456',
          account_id: 'acc-123',
          current_balance: 1200.75,
          recorded_at: expect.any(String)
        }
        
        // Create a fresh mock for this test
        const mockInsertChain = {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockInsertResult, error: null }))
            }))
          }))
        }
        
        // Override the mock for this specific test
        mockSupabaseClient.from.mockImplementation((table) => {
          if (table === 'account_snapshots') {
            return {
              select: jest.fn(() => mockSelectChain),
              insert: jest.fn(() => mockInsertChain.insert())
            }
          }
          return mockFromChain
        })
        
        const account = {
          balances: { current: 1200.75, available: 1200.75 }
        }
        
        const result = await createAccountSnapshotConditional(account, 'acc-123')
        
        expect(result.success).toBe(true)
        expect(result.skipped).toBeFalsy()
        expect(result.data).toBeDefined()
        expect(result.reason).toContain('Date different')
      })

      test('should skip snapshot when conditions are not met', async () => {
        const today = new Date().toISOString().split('T')[0]
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: `${today}T12:00:00.000Z`
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { current: 1000.50, available: 1000.50 }
        }
        
        const result = await createAccountSnapshotConditional(account, 'acc-123')
        
        expect(result.success).toBe(true)
        expect(result.skipped).toBe(true)
        expect(result.data).toBeNull()
        expect(result.reason).toContain('Date same: true')
      })

      test('should create snapshot when no previous snapshot exists', async () => {
        // Mock the select chain to return no data (no previous snapshot)
        mockSelectChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        
        // Mock the insert chain for creating new snapshot
        const mockInsertResult = {
          id: 'snapshot-456',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: expect.any(String)
        }
        
        // Create a fresh mock for this test
        const mockInsertChain = {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockInsertResult, error: null }))
            }))
          }))
        }
        
        // Override the mock for this specific test
        mockSupabaseClient.from.mockImplementation((table) => {
          if (table === 'account_snapshots') {
            return {
              select: jest.fn(() => mockSelectChain),
              insert: jest.fn(() => mockInsertChain.insert())
            }
          }
          return mockFromChain
        })
        
        const account = {
          balances: { current: 1000.50, available: 1000.50 }
        }
        
        const result = await createAccountSnapshotConditional(account, 'acc-123')
        
        expect(result.success).toBe(true)
        expect(result.skipped).toBeFalsy()
        expect(result.data).toBeDefined()
        expect(result.reason).toBe('No previous snapshot exists')
      })
    })

    describe('Edge Cases and Error Handling', () => {
      test('should handle missing balance data in shouldCreateAccountSnapshot', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: '2024-01-07T12:00:00.000Z'
        }
        
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {} // No balances property
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        expect(result.shouldCreate).toBe(true) // Date different, balance different (null vs 1000.50)
        expect(result.isDateDifferent).toBe(true)
        expect(result.isBalanceDifferent).toBe(true)
      })

      test('should handle different currency codes correctly', async () => {
        const mockSnapshot = {
          id: 'snapshot-123',
          account_id: 'acc-123',
          current_balance: 1000.50,
          recorded_at: '2024-01-07T12:00:00.000Z'
        }
        
        // Reset the mock for this specific test
        mockSelectChain.single.mockResolvedValueOnce({ data: mockSnapshot, error: null })
        
        const account = {
          balances: { 
            current: 1000.50, 
            available: 1000.50,
            iso_currency_code: 'EUR' // Different currency
          }
        }
        
        const result = await shouldCreateAccountSnapshot(account, 'acc-123')
        
        // Should NOT create because balance is the same (both conditions must be met)
        expect(result.shouldCreate).toBe(false)
        expect(result.isDateDifferent).toBe(true)
        expect(result.isBalanceDifferent).toBe(false) // Same current balance
      })
    })
  })
})
