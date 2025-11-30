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
});
