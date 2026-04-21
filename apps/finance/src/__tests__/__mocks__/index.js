/**
 * Central Mock Exports
 * Provides a single entry point for all test mocks
 */

// Supabase mocks
export * from './supabase'
export { default as supabaseMocks } from './supabase'

// Plaid mocks
export * from './plaidClient'
export { default as plaidMocks } from './plaidClient'

// Re-export commonly used mocks for convenience
export {
  createMockAccount,
  createMockAccountSnapshot,
  createMockInstitution,
  createMockPlaidItem,
  createMockSupabaseClient,
  mockSupabaseResponses
} from './supabase'

export {
  createMockPlaidAccount,
  createMockPlaidInstitution,
  mockPlaidResponses,
  createMockPlaidClient
} from './plaidClient'
