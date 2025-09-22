/**
 * @jest-environment node
 */

// Mock Next.js modules
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, options = {}) => ({
      json: () => Promise.resolve(data),
      status: options.status || 200,
    }),
  },
}));

// Import after mocking
const { GET } = require('../../../app/api/net-worth/by-date/route');

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    }))
  }))
};

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase
}));

describe('/api/net-worth/by-date', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  it('should return 400 if userId is not provided', async () => {
    const request = new Request('http://localhost:3000/api/net-worth/by-date');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('User ID is required');
  });

  it('should return empty data when user has no accounts', async () => {
    // Mock empty accounts
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    });

    const request = new Request('http://localhost:3000/api/net-worth/by-date?userId=test-user');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.message).toBe('No accounts found for user');
  });

  it('should calculate net worth correctly for multiple dates with all accounts included', async () => {
    const userId = 'test-user';
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking' },
      { id: 'acc2', name: 'Credit Card', type: 'credit', subtype: 'credit card' },
      { id: 'acc3', name: 'Savings', type: 'depository', subtype: 'savings' }
    ];

    const snapshots = [
      { recorded_at: '2025-01-15T10:00:00Z' },
      { recorded_at: '2025-01-16T10:00:00Z' }
    ];

    // Mock accounts query
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'accounts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: accounts, error: null }))
          }))
        };
      }
      
      if (table === 'account_snapshots') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => {
              // First call returns unique dates
              if (!mockSupabase.from().select().in().order) {
                return {
                  order: jest.fn(() => Promise.resolve({ data: snapshots, error: null }))
                };
              }
              // Subsequent calls return account snapshots for specific accounts/dates
              return {
                eq: jest.fn(() => ({
                  lte: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => Promise.resolve({ 
                        data: [{ current_balance: 1000, recorded_at: '2025-01-15T10:00:00Z' }], 
                        error: null 
                      }))
                    }))
                  }))
                }))
              };
            })
          }))
        };
      }
    });

    const request = new Request(`http://localhost:3000/api/net-worth/by-date?userId=${userId}`);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalAccounts).toBe(3);
    expect(data.data.length).toBe(2); // Two unique dates
    expect(data.data[0].totalAccounts).toBe(3); // All accounts should be included
    expect(data.data[1].totalAccounts).toBe(3); // All accounts should be included
  });

  it('should handle liability accounts correctly', async () => {
    const userId = 'test-user';
    const accounts = [
      { id: 'acc1', name: 'Checking', type: 'depository', subtype: 'checking' },
      { id: 'acc2', name: 'Credit Card', type: 'credit', subtype: 'credit card' }
    ];

    const snapshots = [
      { recorded_at: '2025-01-15T10:00:00Z' }
    ];

    // Mock with different balances for different account types
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'accounts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: accounts, error: null }))
          }))
        };
      }
      
      if (table === 'account_snapshots') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: snapshots, error: null }))
            })),
            eq: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => {
                    // Return different balances based on account ID
                    const mockData = acc1 ? 
                      [{ current_balance: 5000, recorded_at: '2025-01-15T10:00:00Z' }] : // Asset
                      [{ current_balance: 1500, recorded_at: '2025-01-15T10:00:00Z' }]; // Liability
                    return Promise.resolve({ data: mockData, error: null });
                  })
                }))
              }))
            }))
          }))
        };
      }
    });

    const request = new Request(`http://localhost:3000/api/net-worth/by-date?userId=${userId}`);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].assets).toBe(5000);
    expect(data.data[0].liabilities).toBe(1500);
    expect(data.data[0].netWorth).toBe(3500); // 5000 - 1500
  });

  it('should handle database errors gracefully', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: new Error('Database error') }))
      }))
    });

    const request = new Request('http://localhost:3000/api/net-worth/by-date?userId=test-user');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch accounts');
  });

  it('should use most recent snapshot for each account on each date', async () => {
    const userId = 'test-user';
    const accounts = [
      { id: 'acc1', name: 'Account 1', type: 'depository', subtype: 'checking' }
    ];

    const snapshots = [
      { recorded_at: '2025-01-15T10:00:00Z' },
      { recorded_at: '2025-01-16T10:00:00Z' }
    ];

    let callCount = 0;
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'accounts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: accounts, error: null }))
          }))
        };
      }
      
      if (table === 'account_snapshots') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: snapshots, error: null }))
            })),
            eq: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => {
                    callCount++;
                    // First call (for 2025-01-15) returns snapshot from 2025-01-15
                    // Second call (for 2025-01-16) returns snapshot from 2025-01-16
                    const balance = callCount === 1 ? 1000 : 2000;
                    const date = callCount === 1 ? '2025-01-15T10:00:00Z' : '2025-01-16T10:00:00Z';
                    return Promise.resolve({ 
                      data: [{ current_balance: balance, recorded_at: date }], 
                      error: null 
                    });
                  })
                }))
              }))
            }))
          }))
        };
      }
    });

    const request = new Request(`http://localhost:3000/api/net-worth/by-date?userId=${userId}`);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.length).toBe(2);
    expect(data.data[0].netWorth).toBe(1000); // First date uses 1000
    expect(data.data[1].netWorth).toBe(2000); // Second date uses 2000 (most recent)
  });

  it('should handle accounts with no snapshots', async () => {
    const userId = 'test-user';
    const accounts = [
      { id: 'acc1', name: 'Account 1', type: 'depository', subtype: 'checking' }
    ];

    const snapshots = [
      { recorded_at: '2025-01-15T10:00:00Z' }
    ];

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'accounts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: accounts, error: null }))
          }))
        };
      }
      
      if (table === 'account_snapshots') {
        return {
          select: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: snapshots, error: null }))
            })),
            eq: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: [], error: null })) // No snapshots
                }))
              }))
            }))
          }))
        };
      }
    });

    const request = new Request(`http://localhost:3000/api/net-worth/by-date?userId=${userId}`);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].netWorth).toBe(0); // Should default to 0 when no snapshots
    expect(data.data[0].accountBalances.acc1).toBe(0);
  });
});
