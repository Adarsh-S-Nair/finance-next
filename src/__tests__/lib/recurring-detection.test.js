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

describe('detectRecurringTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should detect monthly recurring transactions', async () => {
    const userId = 'user-123';

    // Mock transactions: Netflix every month on the 15th
    const mockTransactions = [
      { id: 1, amount: -15.99, datetime: '2023-10-15T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
      { id: 2, amount: -15.99, datetime: '2023-09-15T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
      { id: 3, amount: -15.99, datetime: '2023-08-15T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
      { id: 4, amount: -15.99, datetime: '2023-07-15T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
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

    const realDate = Date;
    // Mock "Today" as 2023-11-01, shortly after the last transaction (2023-10-15)
    global.Date = class extends Date {
      constructor(date) {
        if (date) return new realDate(date);
        return new realDate('2023-11-01T12:00:00Z');
      }
    };

    try {
      await detectRecurringTransactions(userId);
    } finally {
      global.Date = realDate;
    }

    // Verify upsert was called
    expect(mockUpsert).toHaveBeenCalled();

    const upsertedData = mockUpsert.mock.calls[0][0];
    expect(upsertedData).toHaveLength(1);
    expect(upsertedData[0]).toMatchObject({
      merchant_name: 'Netflix',
      frequency: 'monthly',
      amount: 15.99,
      status: 'active',
      icon_url: 'http://netflix.com/logo.png',
      category_id: 'cat-1'
    });
  });

  it('should detect weekly recurring transactions', async () => {
    const userId = 'user-123';

    // Mock transactions: Coffee every 7 days
    const mockTransactions = [
      { id: 1, amount: -5.00, datetime: '2023-10-21T10:00:00Z', description: 'Weekly Coffee', account_id: 'acc-1' },
      { id: 2, amount: -5.00, datetime: '2023-10-14T10:00:00Z', description: 'Weekly Coffee', account_id: 'acc-1' },
      { id: 3, amount: -5.00, datetime: '2023-10-07T10:00:00Z', description: 'Weekly Coffee', account_id: 'acc-1' },
    ];

    const mockAccounts = [{ id: 'acc-1', user_id: userId }];
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });

    // Setup mocks similar to above...
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

    const realDate = Date;
    // Mock "Today" as 2023-10-25, shortly after the last transaction (2023-10-21)
    global.Date = class extends Date {
      constructor(date) {
        if (date) return new realDate(date);
        return new realDate('2023-10-25T12:00:00Z');
      }
    };

    try {
      await detectRecurringTransactions(userId);
    } finally {
      global.Date = realDate;
    }

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0][0]).toMatchObject({
      description: 'Weekly Coffee',
      frequency: 'weekly'
    });
  });


  test('detects multiple subscriptions from same merchant (e.g. Amazon on 6th and 12th)', async () => {
    const mockTransactions = [
      // Subscription 1: 6th of the month, $10.99
      { amount: -10.99, datetime: '2025-11-06T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' },
      { amount: -10.99, datetime: '2025-10-06T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' },
      { amount: -10.99, datetime: '2025-09-06T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' },

      // Subscription 2: 12th of the month, varying amount
      { amount: -10.99, datetime: '2025-11-12T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' }, // Price increase
      { amount: -10.99, datetime: '2025-10-12T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' },
      { amount: -8.99, datetime: '2025-09-12T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' },
      { amount: -12.65, datetime: '2025-09-11T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' }, // One-off noise

      // Noise
      { amount: -25.00, datetime: '2025-10-20T10:00:00Z', merchant_name: 'Amazon', account_id: 'acc_1' },
    ];

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
        };
      }
      if (table === 'accounts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [{ id: 'acc_1' }], error: null }),
        };
      }
      if (table === 'system_categories') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'recurring_transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: jest.fn() };
    });

    const result = await detectRecurringTransactions('user_123');

    // Should detect TWO Amazon patterns
    const amazonPatterns = result.filter(r => r.merchant_name === 'Amazon');
    expect(amazonPatterns.length).toBeGreaterThanOrEqual(2);

    // Check for 6th pattern
    const pattern6th = amazonPatterns.find(p => {
      const date = new Date(p.next_date);
      return date.getUTCDate() === 6 || date.getUTCDate() === 7; // Allow slight drift logic
    });
    expect(pattern6th).toBeDefined();
    expect(pattern6th.frequency).toBe('monthly');

    // Check for 12th pattern
    const pattern12th = amazonPatterns.find(p => {
      const date = new Date(p.next_date);
      return date.getUTCDate() === 12 || date.getUTCDate() === 13;
    });
    expect(pattern12th).toBeDefined();
    expect(pattern12th.frequency).toBe('monthly');
  });

  test('ignores positive transactions (income)', async () => {
    const mockTransactions = [
      { amount: 2000.00, datetime: '2025-11-01T10:00:00Z', merchant_name: 'Payroll', account_id: 'acc_1' },
      { amount: 2000.00, datetime: '2025-10-01T10:00:00Z', merchant_name: 'Payroll', account_id: 'acc_1' },
      { amount: 2000.00, datetime: '2025-09-01T10:00:00Z', merchant_name: 'Payroll', account_id: 'acc_1' },
    ];

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
        };
      }
      // ... other mocks (accounts, etc.) - reusing from previous tests implicitly via mockImplementation
      if (table === 'accounts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [{ id: 'acc_1' }], error: null }),
        };
      }
      if (table === 'system_categories') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'recurring_transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: jest.fn() };
    });

    const result = await detectRecurringTransactions('user_123');
    expect(result).toHaveLength(0);
  });

  test('uses latest amount for recurring transaction', async () => {
    const mockTransactions = [
      { amount: -12.99, datetime: '2025-11-01T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc_1' }, // Price increase
      { amount: -10.99, datetime: '2025-10-01T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc_1' },
      { amount: -10.99, datetime: '2025-09-01T10:00:00Z', merchant_name: 'Netflix', account_id: 'acc_1' },
    ];

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }),
        };
      }
      if (table === 'accounts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [{ id: 'acc_1' }], error: null }),
        };
      }
      if (table === 'system_categories') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'recurring_transactions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: jest.fn() };
    });

    const result = await detectRecurringTransactions('user_123');
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(12.99); // Should be the latest amount
  });
});
