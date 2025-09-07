# Testing Framework Documentation

This directory contains a comprehensive testing framework for the finance-next application, designed to be scalable, maintainable, and easy to use.

## 📁 Directory Structure

```
src/__tests__/
├── __mocks__/                 # Reusable mock implementations
│   ├── supabase.js           # Supabase client and data mocks
│   ├── plaidClient.js        # Plaid API mocks
│   └── index.js              # Central mock exports
├── utils/                     # Test utilities and helpers
│   ├── testHelpers.js        # Common test utilities
│   ├── testSetup.js          # Test setup and teardown
│   └── index.js              # Utility exports
├── config/                    # Test configuration
│   └── testConfig.js         # Centralized test config
├── lib/                       # Library function tests
│   └── accountSnapshotUtils.*.test.js
├── api/                       # API route tests
│   └── plaid/
│       └── exchange-token.test.js
└── README.md                  # This file
```

## 🚀 Getting Started

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test accountSnapshotUtils
```

### Writing New Tests

1. **Import the necessary utilities:**
```javascript
import { setupTestEnvironment, testPatterns } from '../utils'
import { createMockSupabaseClient, createMockAccount } from '../__mocks__'
```

2. **Use the setup helper:**
```javascript
describeWithSetup('Your Test Suite', () => {
  // Your tests here
})
```

3. **Use mock factories:**
```javascript
const mockAccount = createMockAccount({
  name: 'Custom Account Name',
  balances: { available: 500.00 }
})
```

## 🛠️ Available Mocks

### Supabase Mocks

```javascript
import { 
  createMockSupabaseClient,
  createMockAccount,
  createMockAccountSnapshot,
  createMockInstitution,
  mockSupabaseResponses
} from '../__mocks__'

// Create a mock client
const mockClient = createMockSupabaseClient()

// Create mock data
const account = createMockAccount({ name: 'Custom Name' })
const snapshot = createMockAccountSnapshot({ available_balance: 1000 })

// Use predefined responses
const successResponse = mockSupabaseResponses.success([account])
const errorResponse = mockSupabaseResponses.error('Database error')
```

### Plaid Mocks

```javascript
import { 
  createMockPlaidClient,
  createMockPlaidAccount,
  mockPlaidResponses
} from '../__mocks__/plaidClient'

// Create mock Plaid data
const plaidAccount = createMockPlaidAccount({
  account_id: 'plaid-123',
  balances: { available: 1000.50 }
})

// Use predefined responses
const accountsResponse = mockPlaidResponses.getAccounts([plaidAccount])
```

## 🔧 Test Utilities

### Setup and Teardown

```javascript
import { setupTestEnvironment, describeWithSetup } from '../utils'

// Automatic setup for entire test suite
describeWithSetup('My Tests', () => {
  // Tests automatically get proper setup
})

// Manual setup for individual tests
it('should do something', async () => {
  const cleanup = setupTestEnvironment({
    envVars: { CUSTOM_VAR: 'value' },
    suppressConsoleMethods: ['log', 'warn']
  })
  
  try {
    // Your test code
  } finally {
    cleanup()
  }
})
```

### Common Test Patterns

```javascript
import { testPatterns } from '../utils'

// Test error handling
it('should handle errors', 
  testPatterns.shouldHandleError(
    myFunction,
    [arg1, arg2],
    'Expected error message'
  )
)

// Test success with data
it('should return correct data',
  testPatterns.shouldSucceedWithData(
    myFunction,
    [arg1, arg2],
    expectedData
  )
)
```

### Helper Functions

```javascript
import { 
  suppressConsole,
  createMockPromise,
  flushPromises,
  createMockRequest
} from '../utils'

// Suppress console output
const restoreConsole = suppressConsole(['log', 'error'])

// Create mock promises
const mockPromise = createMockPromise('resolved value', false)

// Wait for async operations
await flushPromises()

// Create mock requests for API testing
const request = createMockRequest({ body: 'data' })
```

## 📋 Test Configuration

### Environment Variables

The test framework automatically sets up common environment variables:

```javascript
// From testConfig.js
NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
NEXT_PUBLIC_APP_URL: 'http://localhost:3000'
NODE_ENV: 'test'
```

### Test Data

Predefined test data is available in `testConfig.js`:

```javascript
import { TEST_DATA } from '../config/testConfig'

const checkingAccount = TEST_DATA.accounts.checking
const bankInstitution = TEST_DATA.institutions.bank
```

## 🎯 Best Practices

### 1. Use Mock Factories

Instead of creating objects manually, use the provided factories:

```javascript
// ❌ Don't do this
const account = {
  id: 'acc-123',
  name: 'Test Account',
  // ... many properties
}

// ✅ Do this
const account = createMockAccount({ name: 'Test Account' })
```

### 2. Test Error Scenarios

Always test both success and error cases:

```javascript
describe('My Function', () => {
  it('should succeed with valid input', async () => {
    // Test success case
  })

  it('should handle invalid input', async () => {
    // Test error case
  })
})
```

### 3. Use Descriptive Test Names

```javascript
// ❌ Don't do this
it('should work', () => {})

// ✅ Do this
it('should create account snapshot when valid account data is provided', () => {})
```

### 4. Clean Up After Tests

```javascript
afterEach(() => {
  jest.clearAllMocks()
  // Clean up any global state
})
```

### 5. Test Integration Scenarios

Don't just test individual functions - test how they work together:

```javascript
it('should handle complete account connection workflow', async () => {
  // Test the entire flow from API call to database update
})
```

## 🔍 Debugging Tests

### Enable Console Output

```javascript
// In your test file
beforeEach(() => {
  // Don't suppress console for debugging
  setupTestEnvironment({ suppressConsoleMethods: [] })
})
```

### Add Debug Logging

```javascript
it('should do something', async () => {
  console.log('Debug: Starting test')
  const result = await myFunction()
  console.log('Debug: Result:', result)
})
```

### Use Jest Debugging

```bash
# Run specific test with verbose output
npm test -- --verbose accountSnapshotUtils

# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 📈 Coverage

The testing framework is configured to generate coverage reports:

```bash
npm run test:coverage
```

Coverage reports will be generated in the `coverage/` directory.

## 🤝 Contributing

When adding new tests:

1. Follow the existing directory structure
2. Use the provided mock factories and utilities
3. Add tests for both success and error scenarios
4. Update this documentation if you add new utilities
5. Ensure all tests pass before submitting

## 📚 Examples

See the existing test files for examples of how to use the framework:

- `lib/accountSnapshotUtils.refactored.test.js` - Library function tests
- `api/plaid/exchange-token.test.js` - API route tests

These examples demonstrate the proper use of mocks, utilities, and test patterns.
