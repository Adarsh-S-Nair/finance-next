/**
 * Test Configuration
 * Centralized configuration for all tests
 */

// Test database configuration
export const TEST_DB_CONFIG = {
  url: 'https://test.supabase.co',
  serviceKey: 'test-service-role-key',
  anonKey: 'test-anon-key'
}

// Test API configuration
export const TEST_API_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 5000
}

// Test user configuration
export const TEST_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User'
}

// Test data configuration
export const TEST_DATA = {
  accounts: {
    checking: {
      id: 'acc-checking-123',
      name: 'Test Checking Account',
      type: 'depository',
      subtype: 'checking',
      balances: {
        available: 1000.50,
        current: 1000.50,
        limit: null,
        iso_currency_code: 'USD'
      }
    },
    credit: {
      id: 'acc-credit-456',
      name: 'Test Credit Card',
      type: 'credit',
      subtype: 'credit_card',
      balances: {
        available: null,
        current: -500.25,
        limit: 5000.00,
        iso_currency_code: 'USD'
      }
    }
  },
  institutions: {
    bank: {
      id: 'inst-bank-123',
      name: 'Test Bank',
      logo: 'https://example.com/bank-logo.png',
      primary_color: '#1a73e8',
      url: 'https://testbank.com'
    }
  }
}

// Test timeout configuration
export const TEST_TIMEOUTS = {
  short: 1000,
  medium: 5000,
  long: 10000
}

// Test environment variables
export const TEST_ENV = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SUPABASE_URL: TEST_DB_CONFIG.url,
  SUPABASE_SERVICE_ROLE_KEY: TEST_DB_CONFIG.serviceKey,
  NEXT_PUBLIC_APP_URL: TEST_API_CONFIG.baseUrl
}

// Mock configuration
export const MOCK_CONFIG = {
  supabase: {
    defaultResponse: { data: [], error: null },
    errorResponse: { data: null, error: { message: 'Database error' } }
  },
  plaid: {
    defaultAccessToken: 'test-access-token-123',
    defaultItemId: 'test-item-123',
    defaultInstitutionId: 'ins_test123'
  }
}
