import { GET } from '../../../../app/api/net-worth/history/route';

// Mock NextResponse
const NextResponse = {
  json: (data, options) => ({
    json: () => Promise.resolve({ data: data.data, error: data.error }),
    status: options?.status || 200,
  }),
};

// Mock the module
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, options) => ({
      json: () => Promise.resolve(data), // Simplified for test
      status: options?.status || 200,
    }),
  },
}));

// Mock supabaseAdmin
jest.mock('../../../../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  },
}));

import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

describe('Net Worth History API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should backfill account balance before the first snapshot', async () => {
    // Mock request
    const request = {
      url: 'http://localhost:3000/api/net-worth/history?userId=user123&months=1',
    };

    // Calculate dates relative to now
    const now = new Date();
    const day1Date = new Date(now);
    day1Date.setDate(now.getDate() - 30);
    const day1Str = day1Date.toISOString().split('T')[0];

    const day15Date = new Date(now);
    day15Date.setDate(now.getDate() - 15);
    const day15Str = day15Date.toISOString().split('T')[0];

    const day30Date = new Date(now);
    const day30Str = day30Date.toISOString().split('T')[0];

    // Mock accounts
    const accounts = [
      { id: 'acc1', type: 'depository', subtype: 'checking' }, // Existing account
      { id: 'acc2', type: 'investment', subtype: 'brokerage' }, // New account added later
    ];

    // Mock snapshots
    // acc1 has data from day 1
    // acc2 only has data from day 15, but started with 10k
    const snapshots = [
      // Day 1
      { account_id: 'acc1', current_balance: 5000, recorded_at: day1Date.toISOString() },
      // Day 15 (acc2 linked)
      { account_id: 'acc1', current_balance: 5500, recorded_at: day15Date.toISOString() },
      { account_id: 'acc2', current_balance: 10000, recorded_at: day15Date.toISOString() },
      // Day 30
      { account_id: 'acc1', current_balance: 6000, recorded_at: day30Date.toISOString() },
      { account_id: 'acc2', current_balance: 10500, recorded_at: day30Date.toISOString() },
    ];

    // Setup mocks
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'accounts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ data: accounts, error: null }),
        };
      }
      if (table === 'account_snapshots') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: snapshots, error: null }),
        };
      }
      return { select: jest.fn() };
    });

    const response = await GET(request);
    const json = await response.json();

    expect(json.data).toBeDefined();
    const history = json.data;

    // Find the entry for Day 1
    const day1 = history.find(h => h.date === day1Str);

    if (day1) {
      // WITH FIX: Day 1 net worth should be 15000 (acc1: 5000 + acc2: 10000 backfilled)
      expect(day1.netWorth).toBe(15000);
    } else {
      // If day1 is missing (which shouldn't happen as we provided a snapshot), fail.
      expect(day1).toBeDefined();
    }
  });
});
