import { detectRecurringTransactions } from '../../lib/recurring-detection';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

// Mock supabaseAdmin
jest.mock('../../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('detectRecurringTransactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==============================================================================
  // 1. Core Functionality
  // ==============================================================================
  describe('Core Functionality', () => {
    it('should detect monthly recurring transactions (Netflix)', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -15.99, datetime: '2023-10-15T10:00:00Z', date: '2023-10-15', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
        { id: 2, amount: -15.99, datetime: '2023-09-15T10:00:00Z', date: '2023-09-15', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
        { id: 3, amount: -15.99, datetime: '2023-08-15T10:00:00Z', date: '2023-08-15', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
        { id: 4, amount: -15.99, datetime: '2023-07-15T10:00:00Z', date: '2023-07-15', merchant_name: 'Netflix', account_id: 'acc-1', icon_url: 'http://netflix.com/logo.png', category_id: 'cat-1' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2023-11-01T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      expect(mockUpsert).toHaveBeenCalled();
      expect(mockUpsert.mock.calls[0][0][0]).toMatchObject({ merchant_name: 'Netflix', frequency: 'monthly', amount: 15.99 });
    });

    it('should detect weekly recurring transactions (Coffee)', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -5.00, datetime: '2023-10-21T10:00:00Z', date: '2023-10-21', description: 'Weekly Coffee', account_id: 'acc-1' },
        { id: 2, amount: -5.00, datetime: '2023-10-14T10:00:00Z', date: '2023-10-14', description: 'Weekly Coffee', account_id: 'acc-1' },
        { id: 3, amount: -5.00, datetime: '2023-10-07T10:00:00Z', date: '2023-10-07', description: 'Weekly Coffee', account_id: 'acc-1' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2023-10-25T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      expect(mockUpsert).toHaveBeenCalled();
      expect(mockUpsert.mock.calls[0][0][0]).toMatchObject({ description: 'Weekly Coffee', frequency: 'weekly' });
    });

    it('should ignore positive transactions (income)', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { amount: 2000.00, datetime: '2025-11-01T10:00:00Z', date: '2025-11-01', merchant_name: 'Payroll', account_id: 'acc-1' },
        { amount: 2000.00, datetime: '2025-10-01T10:00:00Z', date: '2025-10-01', merchant_name: 'Payroll', account_id: 'acc-1' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      await detectRecurringTransactions(userId);
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  // ==============================================================================
  // 2. Irregular Utilities
  // ==============================================================================
  describe('Irregular Utilities', () => {
    it('should detect National Grid with skipped months', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -296.30, datetime: '2025-11-13T10:00:00Z', date: '2025-11-13', merchant_name: 'National Grid', account_id: 'acc-1', category_id: 'cat-util' },
        { id: 2, amount: -300.68, datetime: '2025-09-21T10:00:00Z', date: '2025-09-21', merchant_name: 'National Grid', account_id: 'acc-1', category_id: 'cat-util' },
        { id: 3, amount: -160.53, datetime: '2025-07-24T10:00:00Z', date: '2025-07-24', merchant_name: 'National Grid', account_id: 'acc-1', category_id: 'cat-util' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [{ id: 'cat-util', label: 'Gas and Electricity' }], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2025-11-20T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      expect(mockUpsert).toHaveBeenCalled();
      const nationalGrid = mockUpsert.mock.calls[0][0].find(t => t.merchant_name === 'National Grid');
      expect(nationalGrid).toBeDefined();
      expect(nationalGrid.frequency).toBe('monthly');
    });

    it('should detect Pseg Li Residential with irregular intervals', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -126.24, datetime: '2025-11-29T12:00:00Z', date: '2025-11-29', merchant_name: 'Pseg Li Residential', account_id: 'acc-1', category_id: 'cat-util' },
        { id: 2, amount: -151.79, datetime: '2025-09-21T12:00:00Z', date: '2025-09-21', merchant_name: 'Pseg Li Residential', account_id: 'acc-1', category_id: 'cat-util' },
        { id: 3, amount: -33.59, datetime: '2025-07-01T12:00:00Z', date: '2025-07-01', merchant_name: 'Pseg Li Residential', account_id: 'acc-1', category_id: 'cat-util' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [{ id: 'cat-util', label: 'Gas and Electricity' }], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2025-12-02T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      expect(mockUpsert).toHaveBeenCalled();
      const pseg = mockUpsert.mock.calls[0][0].find(t => t.merchant_name === 'Pseg Li Residential');
      expect(pseg).toBeDefined();
      expect(pseg.frequency).toBe('monthly');
    });
  });

  // ==============================================================================
  // 3. False Positives
  // ==============================================================================
  describe('False Positives', () => {
    it('should IGNORE Taco Bell (Fast Food) due to hard exclusion', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -11.25, datetime: '2025-03-01T12:00:00Z', date: '2025-03-01', merchant_name: 'Taco Bell', account_id: 'acc-1', category_id: 'cat-food' },
        { id: 2, amount: -14.50, datetime: '2025-02-02T12:00:00Z', date: '2025-02-02', merchant_name: 'Taco Bell', account_id: 'acc-1', category_id: 'cat-food' },
        { id: 3, amount: -12.00, datetime: '2025-01-01T12:00:00Z', date: '2025-01-01', merchant_name: 'Taco Bell', account_id: 'acc-1', category_id: 'cat-food' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [{ id: 'cat-food', label: 'Fast Food' }], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2025-03-15T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      if (mockUpsert.mock.calls.length > 0) {
        const upsertedData = mockUpsert.mock.calls[0][0];
        const tacoBell = upsertedData.find(t => t.merchant_name === 'Taco Bell');
        expect(tacoBell).toBeUndefined();
      } else {
        expect(true).toBe(true);
      }
    });

    it('should IGNORE variable expenses with random days (e.g. 7-Eleven)', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -12.50, date: '2025-11-02', merchant_name: '7-Eleven', account_id: 'acc-1', category_id: 'cat-conv' },
        { id: 2, amount: -15.20, date: '2025-10-15', merchant_name: '7-Eleven', account_id: 'acc-1', category_id: 'cat-conv' },
        { id: 3, amount: -10.00, date: '2025-09-28', merchant_name: '7-Eleven', account_id: 'acc-1', category_id: 'cat-conv' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [{ id: 'cat-conv', label: 'Convenience Stores' }], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2025-11-20T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      if (mockUpsert.mock.calls.length > 0) {
        const upsertedData = mockUpsert.mock.calls[0][0];
        const sevenEleven = upsertedData.find(t => t.merchant_name === '7-Eleven');
        expect(sevenEleven).toBeUndefined();
      } else {
        expect(true).toBe(true);
      }
    });
  });

  // ==============================================================================
  // 4. New Subscriptions (2 Transactions)
  // ==============================================================================
  describe('New Subscriptions', () => {
    it('should detect Xai LLC with only 2 transactions if identical', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 1, amount: -30.00, datetime: '2025-11-28T12:00:00Z', date: '2025-11-28', merchant_name: 'Xai LLC', account_id: 'acc-1', category_id: 'cat-service' },
        { id: 2, amount: -30.00, datetime: '2025-10-28T12:00:00Z', date: '2025-10-28', merchant_name: 'Xai LLC', account_id: 'acc-1', category_id: 'cat-service' },
      ];
      const mockAccounts = [{ id: 'acc-1', user_id: userId }];
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null }) };
        if (table === 'accounts') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: mockAccounts, error: null }) };
        if (table === 'system_categories') return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }), then: (resolve) => resolve({ data: [{ id: 'cat-service', label: 'Other General Services' }], error: null }) };
        if (table === 'recurring_transactions') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }), upsert: mockUpsert };
        return { select: jest.fn() };
      });

      const realDate = Date;
      global.Date = class extends Date { constructor(date) { if (date) return new realDate(date); return new realDate('2025-12-02T12:00:00Z'); } };
      try { await detectRecurringTransactions(userId); } finally { global.Date = realDate; }

      expect(mockUpsert).toHaveBeenCalled();
      const xai = mockUpsert.mock.calls[0][0].find(t => t.merchant_name === 'Xai LLC');
      expect(xai).toBeDefined();
      expect(xai.frequency).toBe('monthly');
      expect(xai.amount).toBe(30.00);
    });
  });
});
