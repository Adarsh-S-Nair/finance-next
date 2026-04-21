/**
 * Test Helper Utilities
 * Common utilities and helpers for writing tests
 */

/**
 * Suppresses console output during tests
 * @param {string[]} methods - Array of console methods to suppress
 */
export const suppressConsole = (methods = ['log', 'warn', 'error']) => {
  const originalMethods = {}
  
  methods.forEach(method => {
    originalMethods[method] = console[method]
    console[method] = jest.fn()
  })
  
  return () => {
    methods.forEach(method => {
      console[method] = originalMethods[method]
    })
  }
}

/**
 * Creates a mock function that returns a promise
 * @param {*} resolvedValue - Value to resolve with
 * @param {boolean} shouldReject - Whether to reject instead of resolve
 * @param {*} rejectedValue - Value to reject with
 */
export const createMockPromise = (resolvedValue = null, shouldReject = false, rejectedValue = null) => {
  return jest.fn(() => {
    return shouldReject 
      ? Promise.reject(rejectedValue || new Error('Mock rejection'))
      : Promise.resolve(resolvedValue)
  })
}

/**
 * Creates a mock function that returns a chainable object
 * @param {*} finalValue - Final value to return
 */
export const createMockChain = (finalValue = { data: [], error: null }) => {
  const mockChain = {
    select: jest.fn(() => Promise.resolve(finalValue)),
    insert: jest.fn(() => Promise.resolve(finalValue)),
    update: jest.fn(() => Promise.resolve(finalValue)),
    delete: jest.fn(() => Promise.resolve(finalValue)),
    upsert: jest.fn(() => Promise.resolve(finalValue)),
    eq: jest.fn(() => mockChain),
    single: jest.fn(() => Promise.resolve(finalValue)),
    order: jest.fn(() => mockChain),
    limit: jest.fn(() => mockChain)
  }
  return mockChain
}

/**
 * Waits for all promises to resolve
 * Useful for testing async operations
 */
export const flushPromises = () => new Promise(setImmediate)

/**
 * Creates a mock request object for API route testing
 * @param {Object} body - Request body
 * @param {Object} params - URL parameters
 * @param {Object} headers - Request headers
 */
export const createMockRequest = (body = {}, params = {}, headers = {}) => ({
  json: jest.fn(() => Promise.resolve(body)),
  url: 'http://localhost:3000/api/test',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...headers
  },
  ...params
})

/**
 * Creates a mock response object for API route testing
 */
export const createMockResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    end: jest.fn(() => res),
    setHeader: jest.fn(() => res)
  }
  return res
}

/**
 * Asserts that a function was called with specific arguments
 * @param {jest.Mock} mockFn - The mock function
 * @param {number} callIndex - Which call to check (0-based)
 * @param {*} expectedArgs - Expected arguments
 */
export const expectCallWith = (mockFn, callIndex, expectedArgs) => {
  expect(mockFn).toHaveBeenNthCalledWith(callIndex + 1, ...expectedArgs)
}

/**
 * Asserts that a function was called with an object containing specific properties
 * @param {jest.Mock} mockFn - The mock function
 * @param {number} callIndex - Which call to check (0-based)
 * @param {Object} expectedProps - Expected object properties
 */
export const expectCallWithObject = (mockFn, callIndex, expectedProps) => {
  const call = mockFn.mock.calls[callIndex]
  expect(call[0]).toEqual(expect.objectContaining(expectedProps))
}

/**
 * Creates a test timeout that can be easily cleared
 * @param {number} ms - Timeout duration in milliseconds
 */
export const createTestTimeout = (ms = 5000) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timeout')), ms)
  })
}

/**
 * Mock environment variables for testing
 * @param {Object} envVars - Environment variables to set
 */
export const mockEnvVars = (envVars) => {
  const originalEnv = { ...process.env }
  
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value
  })
  
  return () => {
    process.env = originalEnv
  }
}

/**
 * Creates a mock date for consistent testing
 * @param {string|Date} dateString - Date string or Date object
 */
export const mockDate = (dateString = '2024-01-08T12:00:00.000Z') => {
  const mockDate = new Date(dateString)
  const originalDate = Date
  
  global.Date = jest.fn(() => mockDate)
  global.Date.now = jest.fn(() => mockDate.getTime())
  global.Date.UTC = originalDate.UTC
  global.Date.parse = originalDate.parse
  global.Date.prototype = originalDate.prototype
  
  return () => {
    global.Date = originalDate
  }
}
