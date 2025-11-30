import { detectRecurringTransactions } from '../../lib/recurring-detection';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

// Mock supabaseAdmin
jest.mock('../../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
  },
}));

describe('detectRecurringTransactions - False Positives', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should NOT detect short-term weekly bursts (e.g. vacation) as recurring', async () => {
    const userId = 'user-123';

    // Scenario: User went on a trip last month and ordered DoorDash 3 times, once a week.
    // Current date: Let's assume it's 2023-12-01
    // Transactions: 
    // 1. 2023-10-25
    // 2. 2023-10-18
    // 3. 2023-10-11
    // Gap since last transaction: > 1 month.

    const mockTransactions = [
      { id: 1, amount: -45.50, datetime: '2023-10-25T18:00:00Z', merchant_name: 'DoorDash', account_id: 'acc-1' },
      { id: 2, amount: -32.20, datetime: '2023-10-18T18:00:00Z', merchant_name: 'DoorDash', account_id: 'acc-1' },
      { id: 3, amount: -55.10, datetime: '2023-10-11T18:00:00Z', merchant_name: 'DoorDash', account_id: 'acc-1' },
    ];

    const mockAccounts = [{ id: 'acc-1', user_id: userId }];
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });

    // Setup mocks
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: () => Promise.resolve({ data: mockTransactions, error: null })
              })
            })
          })
        };
      }
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockAccounts, error: null })
          })
        };
      }
      if (table === 'system_categories') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null })
          })
        };
      }
      if (table === 'recurring_transactions') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          }),
          upsert: mockUpsert
        };
      }
      return { select: jest.fn() };
    });

    // We need to mock Date to be consistent relative to the transactions
    // Let's say "Today" is 2023-12-01.
    // Last transaction was Oct 25.
    // Expected next was Nov 1.
    // We missed Nov 1, Nov 8, Nov 15, Nov 22, Nov 29.
    // That's 5 missed cycles.

    const realDate = Date;
    global.Date = class extends Date {
      constructor(date) {
        if (date) return new realDate(date);
        return new realDate('2023-12-01T12:00:00Z');
      }
    };

    try {
      await detectRecurringTransactions(userId);
    } finally {
      global.Date = realDate;
    }

    // Expectation: Should NOT upsert DoorDash
    if (mockUpsert.mock.calls.length > 0) {
      const upsertedData = mockUpsert.mock.calls[0][0];
      const doordash = upsertedData.find(d => d.merchant_name === 'DoorDash');
      expect(doordash).toBeUndefined();
    } else {
      expect(mockUpsert).not.toHaveBeenCalled();
    }
  });
});
