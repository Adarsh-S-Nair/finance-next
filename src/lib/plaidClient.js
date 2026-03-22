/**
 * Plaid client re-export
 *
 * All Plaid functions are now in src/lib/plaid/client.js.
 * That module handles mock routing via PLAID_ENV=mock.
 *
 * This file exists for backward compatibility with any imports
 * using the `lib/plaidClient` path.
 */
export * from './plaid/client';
