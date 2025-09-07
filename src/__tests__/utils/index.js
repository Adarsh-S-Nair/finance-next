/**
 * Test Utilities Index
 * Exports all test utilities and helpers
 */

export * from './testHelpers'
export * from './testSetup'

// Re-export commonly used utilities for convenience
export {
  suppressConsole,
  createMockPromise,
  createMockChain,
  flushPromises,
  createMockRequest,
  createMockResponse,
  expectCallWith,
  expectCallWithObject
} from './testHelpers'

export {
  setupTestEnvironment,
  describeWithSetup,
  itWithSetup,
  testPatterns
} from './testSetup'
