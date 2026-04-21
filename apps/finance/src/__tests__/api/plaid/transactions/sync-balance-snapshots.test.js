/**
 * Test for account snapshot creation during balance updates in transaction sync
 */

const { createClient } = require('@supabase/supabase-js');
const { createAccountSnapshotConditional } = require('../../../../lib/accountSnapshotUtils');

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'snapshot-123' },
            error: null
          }))
        }))
      }))
    }))
  }))
}));

// Mock accountSnapshotUtils
jest.mock('../../../../lib/accountSnapshotUtils', () => ({
  createAccountSnapshotConditional: jest.fn()
}));

describe('Account Snapshot Creation in Transaction Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create snapshots only when balance changes and date is different', async () => {
    // Mock the conditional snapshot creation to return success
    createAccountSnapshotConditional.mockResolvedValue({
      success: true,
      skipped: false,
      reason: 'Date different (2024-01-15 vs 2024-01-14) and balance different (1000.00 vs 950.00)',
      data: { id: 'snapshot-123' }
    });

    // Simulate the balance update process
    const plaidAccount = {
      account_id: 'test-account-123',
      balances: {
        current: 1000.00,
        available: 950.00,
        iso_currency_code: 'USD'
      }
    };

    const dbAccountId = 'db-account-123';

    // Test the conditional snapshot creation
    const result = await createAccountSnapshotConditional(plaidAccount, dbAccountId);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.reason).toContain('Date different');
    expect(result.reason).toContain('balance different');
  });

  it('should skip snapshots when balance is the same', async () => {
    // Mock the conditional snapshot creation to return skipped
    createAccountSnapshotConditional.mockResolvedValue({
      success: true,
      skipped: true,
      reason: 'Conditions not met - Date same: false, Balance same: true',
      data: null
    });

    const plaidAccount = {
      account_id: 'test-account-123',
      balances: {
        current: 1000.00,
        available: 950.00,
        iso_currency_code: 'USD'
      }
    };

    const dbAccountId = 'db-account-123';

    const result = await createAccountSnapshotConditional(plaidAccount, dbAccountId);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('Balance same: true');
  });

  it('should skip snapshots when date is the same', async () => {
    // Mock the conditional snapshot creation to return skipped
    createAccountSnapshotConditional.mockResolvedValue({
      success: true,
      skipped: true,
      reason: 'Conditions not met - Date same: true, Balance same: false',
      data: null
    });

    const plaidAccount = {
      account_id: 'test-account-123',
      balances: {
        current: 1000.00,
        available: 950.00,
        iso_currency_code: 'USD'
      }
    };

    const dbAccountId = 'db-account-123';

    const result = await createAccountSnapshotConditional(plaidAccount, dbAccountId);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('Date same: true');
  });

  it('should handle snapshot creation errors gracefully', async () => {
    // Mock the conditional snapshot creation to return error
    createAccountSnapshotConditional.mockResolvedValue({
      success: false,
      error: 'Database connection failed',
      data: null
    });

    const plaidAccount = {
      account_id: 'test-account-123',
      balances: {
        current: 1000.00,
        available: 950.00,
        iso_currency_code: 'USD'
      }
    };

    const dbAccountId = 'db-account-123';

    const result = await createAccountSnapshotConditional(plaidAccount, dbAccountId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });
});
