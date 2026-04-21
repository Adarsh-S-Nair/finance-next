/**
 * Supabase Mock Factory
 * Provides reusable mock implementations for Supabase client and operations
 */

// Mock data generators
export const createMockAccount = (overrides = {}) => ({
  id: 'acc-123',
  user_id: 'user-123',
  item_id: 'item-123',
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
  access_token: 'access-token-123',
  account_key: 'item-123_plaid-acc-123',
  institution_id: 'inst-123',
  plaid_item_id: 'plaid-item-123',
  created_at: '2024-01-08T12:00:00.000Z',
  updated_at: '2024-01-08T12:00:00.000Z',
  ...overrides
})

export const createMockAccountSnapshot = (overrides = {}) => ({
  id: 'snapshot-123',
  account_id: 'acc-123',
  available_balance: 1000.50,
  current_balance: 1000.50,
  limit_balance: null,
  currency_code: 'USD',
  recorded_at: '2024-01-08T12:00:00.000Z',
  ...overrides
})

export const createMockInstitution = (overrides = {}) => ({
  id: 'inst-123',
  institution_id: 'ins_123',
  name: 'Test Bank',
  logo: 'https://example.com/logo.png',
  primary_color: '#000000',
  url: 'https://testbank.com',
  ...overrides
})

export const createMockPlaidItem = (overrides = {}) => ({
  id: 'plaid-item-123',
  user_id: 'user-123',
  item_id: 'item-123',
  access_token: 'access-token-123',
  transaction_cursor: null,
  last_transaction_sync: null,
  last_balance_sync: null,
  sync_status: 'idle',
  last_error: null,
  created_at: '2024-01-08T12:00:00.000Z',
  updated_at: '2024-01-08T12:00:00.000Z',
  ...overrides
})

// Mock Supabase client factory
export const createMockSupabaseClient = (customMethods = {}) => {
  const mockFromChain = {
    select: jest.fn(() => Promise.resolve({ data: [], error: null })),
    insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    update: jest.fn(() => Promise.resolve({ data: [], error: null })),
    delete: jest.fn(() => Promise.resolve({ data: [], error: null })),
    upsert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    eq: jest.fn(() => mockFromChain),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    order: jest.fn(() => mockFromChain),
    limit: jest.fn(() => mockFromChain),
    ...customMethods
  }

  return {
    from: jest.fn(() => mockFromChain),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null }))
    },
    ...customMethods
  }
}

// Pre-configured mock responses
export const mockSupabaseResponses = {
  success: (data = []) => ({ data, error: null }),
  error: (message = 'Database error') => ({ data: null, error: { message } }),
  empty: () => ({ data: [], error: null })
}

// Mock Supabase client with common configurations
export const createMockSupabaseClientWithData = (tableName, data) => {
  const mockClient = createMockSupabaseClient()
  
  mockClient.from.mockImplementation((table) => {
    if (table === tableName) {
      return {
        select: jest.fn(() => Promise.resolve({ data, error: null })),
        insert: jest.fn(() => Promise.resolve({ data, error: null })),
        update: jest.fn(() => Promise.resolve({ data, error: null })),
        delete: jest.fn(() => Promise.resolve({ data, error: null })),
        upsert: jest.fn(() => Promise.resolve({ data, error: null })),
        eq: jest.fn(() => mockClient.from(table)),
        single: jest.fn(() => Promise.resolve({ data: data[0] || null, error: null })),
        order: jest.fn(() => mockClient.from(table)),
        limit: jest.fn(() => mockClient.from(table))
      }
    }
    return mockClient.from(table)
  })
  
  return mockClient
}

// Default mock for createClient
export const mockCreateClient = jest.fn(() => createMockSupabaseClient())

// Export the main mock
export default {
  createClient: mockCreateClient
}
