/**
 * Test Setup Utilities
 * Common setup and teardown functions for tests
 */

import { suppressConsole, mockEnvVars } from './testHelpers'

/**
 * Default test environment variables
 */
const DEFAULT_ENV_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NODE_ENV: 'test'
}

/**
 * Sets up common test environment
 * @param {Object} options - Setup options
 * @param {Object} options.envVars - Additional environment variables
 * @param {string[]} options.suppressConsole - Console methods to suppress
 * @param {boolean} options.mockFetch - Whether to mock global fetch
 */
export const setupTestEnvironment = (options = {}) => {
  const {
    envVars = {},
    suppressConsoleMethods = ['log', 'warn', 'error'],
    mockFetch = true
  } = options

  // Set up environment variables
  const restoreEnv = mockEnvVars({ ...DEFAULT_ENV_VARS, ...envVars })

  // Suppress console output
  const restoreConsole = suppressConsole(suppressConsoleMethods)

  // Mock global fetch if requested
  let restoreFetch
  if (mockFetch) {
    const originalFetch = global.fetch
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      status: 200
    }))
    restoreFetch = () => { global.fetch = originalFetch }
  }

  // Mock Response object for API routes
  if (!global.Response) {
    global.Response = {
      json: (data, init = {}) => ({
        json: () => Promise.resolve(data),
        status: init.status || 200,
        ...init
      })
    }
  }

  // Return cleanup function
  return () => {
    restoreEnv()
    restoreConsole()
    if (restoreFetch) restoreFetch()
  }
}

/**
 * Creates a test suite with common setup
 * @param {string} description - Test suite description
 * @param {Function} tests - Test function
 * @param {Object} options - Setup options
 */
export const describeWithSetup = (description, tests, options = {}) => {
  describe(description, () => {
    let cleanup

    beforeAll(() => {
      cleanup = setupTestEnvironment(options)
    })

    afterAll(() => {
      if (cleanup) cleanup()
    })

    tests()
  })
}

/**
 * Creates a test with automatic cleanup
 * @param {string} description - Test description
 * @param {Function} testFn - Test function
 * @param {Object} options - Setup options
 */
export const itWithSetup = (description, testFn, options = {}) => {
  it(description, async () => {
    const cleanup = setupTestEnvironment(options)
    try {
      await testFn()
    } finally {
      cleanup()
    }
  })
}

/**
 * Common test patterns
 */
export const testPatterns = {
  /**
   * Tests that a function handles errors gracefully
   * @param {Function} fn - Function to test
   * @param {Array} args - Arguments to pass to function
   * @param {string} expectedError - Expected error message
   */
  shouldHandleError: (fn, args, expectedError) => {
    return async () => {
      const result = await fn(...args)
      expect(result.success).toBe(false)
      expect(result.error).toContain(expectedError)
    }
  },

  /**
   * Tests that a function succeeds with expected data
   * @param {Function} fn - Function to test
   * @param {Array} args - Arguments to pass to function
   * @param {*} expectedData - Expected return data
   */
  shouldSucceedWithData: (fn, args, expectedData) => {
    return async () => {
      const result = await fn(...args)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(expectedData)
    }
  },

  /**
   * Tests that a mock was called with specific arguments
   * @param {jest.Mock} mockFn - Mock function
   * @param {*} expectedArgs - Expected arguments
   */
  shouldBeCalledWith: (mockFn, expectedArgs) => {
    return () => {
      expect(mockFn).toHaveBeenCalledWith(...expectedArgs)
    }
  }
}
