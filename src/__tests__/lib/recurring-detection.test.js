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
      { id: 1, amount: -15.99, date: '2023-10-15', merchant_name: 'Netflix', account_id: 'acc-1' },
      { id: 2, amount: -15.99, date: '2023-09-15', merchant_name: 'Netflix', account_id: 'acc-1' },
      { id: 3, amount: -15.99, date: '2023-08-15', merchant_name: 'Netflix', account_id: 'acc-1' },
      { id: 4, amount: -15.99, date: '2023-07-15', merchant_name: 'Netflix', account_id: 'acc-1' },
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

    await detectRecurringTransactions(userId);

    // Verify upsert was called
    expect(mockUpsert).toHaveBeenCalled();

    const upsertedData = mockUpsert.mock.calls[0][0];
    expect(upsertedData).toHaveLength(1);
    expect(upsertedData[0]).toMatchObject({
      merchant_name: 'Netflix',
      frequency: 'monthly',
      amount: 15.99,
      status: 'active'
    });
  });

  it('should detect weekly recurring transactions', async () => {
    const userId = 'user-123';

    // Mock transactions: Coffee every 7 days
    const mockTransactions = [
      { id: 1, amount: -5.00, date: '2023-10-21', description: 'Weekly Coffee', account_id: 'acc-1' },
      { id: 2, amount: -5.00, date: '2023-10-14', description: 'Weekly Coffee', account_id: 'acc-1' },
      { id: 3, amount: -5.00, date: '2023-10-07', description: 'Weekly Coffee', account_id: 'acc-1' },
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

    await detectRecurringTransactions(userId);

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0][0]).toMatchObject({
      description: 'Weekly Coffee',
      frequency: 'weekly'
    });
  });
});
