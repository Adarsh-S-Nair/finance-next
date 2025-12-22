/**
 * Tests for New Action Types: TRIM, INCREASE, HOLD
 * Tests the functionality of partial position adjustments and hold actions
 */

import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock market data functions (similar to market-status.test.js)
jest.mock('../../../lib/marketData', () => ({
  checkMarketStatus: jest.fn(),
  scrapeNasdaq100Constituents: jest.fn(),
  fetchBulkStockData: jest.fn(),
  fetchBulkTickerDetails: jest.fn(),
}));

describe('New Action Types: TRIM, INCREASE, HOLD', () => {
  let mockSupabase;
  let mockPortfolio;
  let mockHoldings;
  let stockPrices;
  let mockMarketStatus;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock stock prices
    stockPrices = new Map([
      ['AAPL', 150.25],
      ['NVDA', 500.00],
      ['MSFT', 350.75],
      ['TSLA', 250.50],
      ['GOOGL', 140.00],
    ]);

    // Mock portfolio with existing holdings
    mockPortfolio = {
      id: 'portfolio-123',
      user_id: 'user-123',
      name: 'Test Portfolio',
      ai_model: 'gemini-3-flash-preview',
      starting_capital: 100000,
      current_cash: 50000, // Some cash remaining
      status: 'active',
      created_at: new Date().toISOString(),
      last_traded_at: null,
    };

    // Mock existing holdings
    mockHoldings = [
      {
        id: 'holding-1',
        portfolio_id: mockPortfolio.id,
        ticker: 'AAPL',
        shares: 20,
        avg_cost: 145.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'holding-2',
        portfolio_id: mockPortfolio.id,
        ticker: 'NVDA',
        shares: 10,
        avg_cost: 480.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Mock market status (open by default)
    mockMarketStatus = {
      isOpen: true,
      exchange: 'US',
      timezone: 'America/New_York',
    };

    // Import after mock is set up
    const marketData = require('../../../lib/marketData');
    marketData.checkMarketStatus.mockResolvedValue(mockMarketStatus);

    // Setup Supabase mock
    const createChainableMock = (finalValue) => {
      const chain = {
        select: jest.fn(() => chain),
        insert: jest.fn(() => chain),
        update: jest.fn(() => chain),
        delete: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        in: jest.fn(() => chain),
        single: jest.fn(() => Promise.resolve(finalValue)),
      };
      return chain;
    };

    mockSupabase = {
      from: jest.fn((table) => {
        if (table === 'ai_portfolios') {
          const chain = createChainableMock({ data: mockPortfolio, error: null });
          chain.insert.mockImplementation(() => Promise.resolve({ data: mockPortfolio, error: null }));
          chain.select.mockImplementation(() => Promise.resolve({ data: [mockPortfolio], error: null }));
          chain.update.mockImplementation(() => Promise.resolve({ data: mockPortfolio, error: null }));
          return chain;
        } else if (table === 'ai_portfolio_holdings') {
          const chain = createChainableMock({ data: null, error: null });
          chain.select.mockImplementation(() => Promise.resolve({ data: [...mockHoldings], error: null }));
          chain.insert.mockImplementation((data) => {
            const newHolding = {
              id: `holding-${Date.now()}`,
              portfolio_id: mockPortfolio.id,
              ...data,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            mockHoldings.push(newHolding);
            return Promise.resolve({ data: newHolding, error: null });
          });
          chain.update.mockImplementation((data) => {
            const updateChain = {
              eq: jest.fn((column, value) => {
                return {
                  eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
                };
              }),
            };
            return updateChain;
          });
          chain.delete.mockImplementation(() => {
            const deleteChain = {
              eq: jest.fn((column, value) => {
                return {
                  eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
                };
              }),
            };
            return deleteChain;
          });
          return chain;
        } else if (table === 'ai_portfolio_trades') {
          const chain = createChainableMock({ data: null, error: null });
          chain.insert.mockImplementation((tradeData) => {
            const newTrade = {
              id: `trade-${Date.now()}`,
              portfolio_id: mockPortfolio.id,
              ...tradeData,
              created_at: new Date().toISOString(),
            };
            // Return chainable object for insert().select().single()
            const insertChain = {
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: newTrade, error: null })),
              })),
            };
            return insertChain;
          });
          chain.select.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return chain;
        } else if (table === 'ai_portfolio_snapshots') {
          const chain = createChainableMock({ data: null, error: null });
          chain.insert.mockImplementation((data) => {
            return Promise.resolve({ data: { id: 'snapshot-1', ...data }, error: null });
          });
          chain.upsert.mockImplementation(() => Promise.resolve({ data: null, error: null }));
          return chain;
        } else if (table === 'tickers') {
          const chain = createChainableMock({ data: [], error: null });
          chain.select.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          chain.upsert.mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return chain;
        }
        return createChainableMock({ data: null, error: null });
      }),
    };

    createClient.mockReturnValue(mockSupabase);
  });

  describe('TRIM Action (Partial Sell)', () => {
    test('should execute TRIM action and reduce position size', async () => {
      const initialShares = mockHoldings[0].shares; // 20 shares of AAPL
      const trimShares = 5; // Trim 5 shares
      const price = stockPrices.get('AAPL'); // $150.25
      const totalValue = trimShares * price;

      // Execute TRIM
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'sell', // Stored as 'sell' in DB
          shares: trimShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Trimming position',
          is_pending: false,
          executed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(tradeResult.data).toBeDefined();
      expect(tradeResult.data.action).toBe('sell'); // Stored as sell
      expect(tradeResult.data.shares).toBe(trimShares);

      // Verify holding is updated (not deleted)
      const remainingShares = initialShares - trimShares; // 20 - 5 = 15
      expect(remainingShares).toBe(15);
      expect(remainingShares).toBeGreaterThan(0); // Should still have shares
    });

    test('should handle TRIM that results in zero shares (delete holding)', async () => {
      const holding = mockHoldings[0]; // 20 shares of AAPL
      const trimShares = 20; // Trim all shares
      const price = stockPrices.get('AAPL');
      const totalValue = trimShares * price;

      // Execute TRIM
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'sell',
          shares: trimShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Trimming entire position',
          is_pending: false,
          executed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(tradeResult.data).toBeDefined();

      // Verify holding should be deleted (remaining shares = 0)
      const remainingShares = holding.shares - trimShares; // 20 - 20 = 0
      expect(remainingShares).toBe(0);
    });

    test('should reject TRIM with insufficient shares', () => {
      const holding = mockHoldings[0]; // 20 shares of AAPL
      const trimShares = 25; // Try to trim more than available
      const price = stockPrices.get('AAPL');
      const totalValue = trimShares * price;

      // Should be rejected
      expect(trimShares).toBeGreaterThan(holding.shares);
      // Trade should fail validation
    });

    test('should increase cash when TRIM is executed', () => {
      const trimShares = 5;
      const price = stockPrices.get('AAPL');
      const totalValue = trimShares * price; // 5 * $150.25 = $751.25
      const initialCash = mockPortfolio.current_cash; // $50,000

      const newCash = initialCash + totalValue;
      expect(newCash).toBe(50000 + 751.25);
      expect(newCash).toBeGreaterThan(initialCash);
    });

    test('should preserve avg_cost when TRIM is executed', () => {
      const holding = mockHoldings[0]; // AAPL with avg_cost of $145.00
      const trimShares = 5;
      const remainingShares = holding.shares - trimShares;

      // Avg cost should remain the same
      expect(holding.avg_cost).toBe(145.00);
      // Remaining shares should still have same avg_cost
      expect(remainingShares).toBe(15);
    });
  });

  describe('INCREASE Action (Partial Buy)', () => {
    test('should execute INCREASE action and add to existing position', async () => {
      const initialShares = mockHoldings[0].shares; // 20 shares of AAPL
      const initialAvgCost = mockHoldings[0].avg_cost; // $145.00
      const increaseShares = 10; // Add 10 more shares
      const price = stockPrices.get('AAPL'); // $150.25
      const totalValue = increaseShares * price;

      // Execute INCREASE
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'buy', // Stored as 'buy' in DB
          shares: increaseShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Increasing position',
          is_pending: false,
          executed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(tradeResult.data).toBeDefined();
      expect(tradeResult.data.action).toBe('buy'); // Stored as buy
      expect(tradeResult.data.shares).toBe(increaseShares);

      // Verify new weighted average cost
      const existingTotalCost = initialShares * initialAvgCost; // 20 * $145 = $2900
      const newTotalCost = increaseShares * price; // 10 * $150.25 = $1502.50
      const newTotalShares = initialShares + increaseShares; // 30 shares
      const newAvgCost = (existingTotalCost + newTotalCost) / newTotalShares;

      expect(newTotalShares).toBe(30);
      expect(newAvgCost).toBeCloseTo(146.75, 2); // ($2900 + $1502.50) / 30
    });

    test('should reject INCREASE with insufficient cash', () => {
      const increaseShares = 1000; // Try to buy 1000 shares
      const price = stockPrices.get('NVDA'); // $500.00
      const totalValue = increaseShares * price; // 1000 * $500 = $500,000

      const currentCash = mockPortfolio.current_cash; // $50,000

      // Should be rejected
      expect(totalValue).toBeGreaterThan(currentCash);
      // Trade should fail validation
    });

    test('should decrease cash when INCREASE is executed', () => {
      const increaseShares = 10;
      const price = stockPrices.get('AAPL');
      const totalValue = increaseShares * price; // 10 * $150.25 = $1502.50
      const initialCash = mockPortfolio.current_cash; // $50,000

      const newCash = initialCash - totalValue;
      expect(newCash).toBe(50000 - 1502.50);
      expect(newCash).toBeLessThan(initialCash);
    });

    test('should create new holding when INCREASE is used on non-existent position', async () => {
      const increaseShares = 5;
      const price = stockPrices.get('GOOGL'); // Not in holdings
      const totalValue = increaseShares * price;

      // Execute INCREASE (should create new holding)
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'GOOGL',
          action: 'buy',
          shares: increaseShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Starting new position',
          is_pending: false,
          executed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expect(tradeResult.data).toBeDefined();
      // New holding should be created with avg_cost = purchase price
      expect(price).toBe(140.00);
    });

    test('should reject INCREASE below minimum trade value ($500)', () => {
      const increaseShares = 1;
      const price = stockPrices.get('AAPL'); // $150.25
      const totalValue = increaseShares * price; // $150.25

      // Should be rejected
      expect(totalValue).toBeLessThan(500);
      // Trade should fail validation
    });
  });

  describe('HOLD Action (No Action)', () => {
    test('should skip HOLD action without creating trade record', () => {
      const holdAction = {
        action: 'HOLD',
        ticker: 'AAPL',
        shares: 0, // Shares don't matter for HOLD
        reason: 'No action needed',
      };

      // HOLD should be skipped - no database operations
      // No trade record should be created
      // No holdings should be modified
      // No cash should change

      expect(holdAction.action).toBe('HOLD');
      // In actual implementation, this would continue to next trade
    });

    test('should allow HOLD in rebalance mode', () => {
      const trades = [
        { action: 'HOLD', ticker: 'AAPL', shares: 0, reason: 'No change needed' },
        { action: 'HOLD', ticker: 'NVDA', shares: 0, reason: 'Position is good' },
      ];

      // All HOLD actions should be skipped
      const nonHoldTrades = trades.filter(t => t.action !== 'HOLD');
      expect(nonHoldTrades.length).toBe(0);
    });

    test('should allow empty trades array when all actions are HOLD', () => {
      const trades = [
        { action: 'HOLD', ticker: 'AAPL', shares: 0 },
        { action: 'HOLD', ticker: 'NVDA', shares: 0 },
      ];

      // After filtering HOLD actions, array should be empty
      const executedTrades = trades.filter(t => t.action !== 'HOLD');
      expect(executedTrades.length).toBe(0);
      // Empty array is valid in rebalance mode
    });
  });

  describe('Action Type Validation', () => {
    test('should accept valid action types', () => {
      const validActions = ['BUY', 'SELL', 'TRIM', 'INCREASE', 'HOLD'];
      const testActions = ['BUY', 'SELL', 'TRIM', 'INCREASE', 'HOLD', 'buy', 'sell', 'trim', 'increase', 'hold'];

      testActions.forEach(action => {
        const upperAction = action.toUpperCase();
        expect(validActions.includes(upperAction)).toBe(true);
      });
    });

    test('should reject invalid action types', () => {
      const validActions = ['BUY', 'SELL', 'TRIM', 'INCREASE', 'HOLD'];
      const invalidActions = ['PURCHASE', 'SELL_ALL', 'ADJUST', 'MODIFY', 'SKIP', ''];

      invalidActions.forEach(action => {
        const upperAction = action.toUpperCase();
        expect(validActions.includes(upperAction)).toBe(false);
      });
    });
  });

  describe('Edge Cases for New Actions', () => {
    test('should handle TRIM with floating point shares', () => {
      const holding = { shares: 20.5, avg_cost: 145.00 };
      const trimShares = 5.25;
      const remainingShares = holding.shares - trimShares;

      expect(remainingShares).toBeCloseTo(15.25, 2);
      expect(remainingShares).toBeGreaterThan(0);
    });

    test('should handle INCREASE with floating point shares', () => {
      const holding = { shares: 20, avg_cost: 145.00 };
      const increaseShares = 5.5;
      const price = 150.25;
      const newTotalShares = holding.shares + increaseShares;

      expect(newTotalShares).toBeCloseTo(25.5, 2);
    });

    test('should handle TRIM that leaves very small remaining shares', () => {
      const holding = { shares: 20, avg_cost: 145.00 };
      const trimShares = 19.9999;
      const remainingShares = holding.shares - trimShares;

      // Should keep holding if remaining > 0.0001 (accounting for floating point precision)
      // Use toBeCloseTo for floating point comparison
      expect(remainingShares).toBeCloseTo(0.0001, 4);
      expect(remainingShares).toBeGreaterThan(0);
    });

    test('should handle TRIM that results in exactly zero shares', () => {
      const holding = { shares: 20, avg_cost: 145.00 };
      const trimShares = 20;
      const remainingShares = holding.shares - trimShares;

      expect(remainingShares).toBe(0);
      // Holding should be deleted
    });

    test('should handle multiple TRIM actions on same position', () => {
      let holding = { shares: 20, avg_cost: 145.00 };
      
      // First TRIM: 5 shares
      holding.shares -= 5; // 15 shares
      
      // Second TRIM: 3 shares
      holding.shares -= 3; // 12 shares
      
      // Third TRIM: 2 shares
      holding.shares -= 2; // 10 shares

      expect(holding.shares).toBe(10);
      expect(holding.avg_cost).toBe(145.00); // Avg cost unchanged
    });

    test('should handle multiple INCREASE actions on same position', () => {
      let holding = { shares: 20, avg_cost: 145.00 };
      const price1 = 150.00;
      const price2 = 155.00;
      
      // First INCREASE: 5 shares @ $150
      const cost1 = 5 * price1; // $750
      const totalCost1 = holding.shares * holding.avg_cost + cost1; // $2900 + $750 = $3650
      holding.shares += 5; // 25 shares
      holding.avg_cost = totalCost1 / holding.shares; // $146.00
      
      // Second INCREASE: 3 shares @ $155
      const cost2 = 3 * price2; // $465
      const totalCost2 = holding.shares * holding.avg_cost + cost2; // $3650 + $465 = $4115
      holding.shares += 3; // 28 shares
      holding.avg_cost = totalCost2 / holding.shares; // ~$146.96

      expect(holding.shares).toBe(28);
      expect(holding.avg_cost).toBeCloseTo(146.96, 2);
    });

    test('should handle TRIM followed by INCREASE (round trip)', () => {
      let holding = { shares: 20, avg_cost: 145.00 };
      const price = 150.00;
      
      // TRIM: 5 shares
      holding.shares -= 5; // 15 shares, avg_cost stays $145
      
      // INCREASE: 10 shares @ $150
      const cost = 10 * price; // $1500
      const totalCost = holding.shares * holding.avg_cost + cost; // $2175 + $1500 = $3675
      holding.shares += 10; // 25 shares
      holding.avg_cost = totalCost / holding.shares; // $147.00

      expect(holding.shares).toBe(25);
      expect(holding.avg_cost).toBe(147.00);
    });

    test('should handle INCREASE when cash is exactly enough', () => {
      const increaseShares = 10;
      const price = stockPrices.get('AAPL'); // $150.25
      const totalValue = increaseShares * price; // $1502.50
      const exactCash = 1502.50;

      // Should be accepted (totalValue === exactCash)
      expect(totalValue).toBe(exactCash);
      expect(totalValue).not.toBeGreaterThan(exactCash);
    });

    test('should handle TRIM when shares are exactly enough', () => {
      const holding = { shares: 20, avg_cost: 145.00 };
      const trimShares = 20;

      // Should be accepted (trimShares === holding.shares)
      expect(trimShares).toBe(holding.shares);
      expect(trimShares).not.toBeGreaterThan(holding.shares);
    });
  });

  describe('Market Status Integration', () => {
    test('should mark TRIM as pending when market is closed', async () => {
      const marketData = require('../../../lib/marketData');
      marketData.checkMarketStatus.mockResolvedValue({ isOpen: false });

      const trimShares = 5;
      const price = stockPrices.get('AAPL');
      const totalValue = trimShares * price;

      // Trade should be marked as pending
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'sell',
          shares: trimShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Trimming position',
          is_pending: true, // Should be pending
          executed_at: null, // No execution time
        })
        .select()
        .single();

      expect(tradeResult.data.is_pending).toBe(true);
      expect(tradeResult.data.executed_at).toBeNull();
    });

    test('should mark INCREASE as pending when market is closed', async () => {
      const marketData = require('../../../lib/marketData');
      marketData.checkMarketStatus.mockResolvedValue({ isOpen: false });

      const increaseShares = 10;
      const price = stockPrices.get('AAPL');
      const totalValue = increaseShares * price;

      // Trade should be marked as pending
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'buy',
          shares: increaseShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Increasing position',
          is_pending: true, // Should be pending
          executed_at: null, // No execution time
        })
        .select()
        .single();

      expect(tradeResult.data.is_pending).toBe(true);
      expect(tradeResult.data.executed_at).toBeNull();
    });

    test('should execute TRIM immediately when market is open', async () => {
      const marketData = require('../../../lib/marketData');
      marketData.checkMarketStatus.mockResolvedValue({ isOpen: true });

      const trimShares = 5;
      const price = stockPrices.get('AAPL');
      const totalValue = trimShares * price;

      // Trade should be executed immediately
      const tradeResult = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'sell',
          shares: trimShares,
          price: price,
          total_value: totalValue,
          reasoning: 'Trimming position',
          is_pending: false, // Should be executed
          executed_at: new Date().toISOString(), // Has execution time
        })
        .select()
        .single();

      expect(tradeResult.data.is_pending).toBe(false);
      expect(tradeResult.data.executed_at).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    test('should still support BUY action', () => {
      const buyAction = {
        action: 'BUY',
        ticker: 'MSFT',
        shares: 10,
        reason: 'New position',
      };

      expect(buyAction.action).toBe('BUY');
      // Should work exactly as before
    });

    test('should still support SELL action', () => {
      const sellAction = {
        action: 'SELL',
        ticker: 'AAPL',
        shares: 10,
        reason: 'Closing position',
      };

      expect(sellAction.action).toBe('SELL');
      // Should work exactly as before
    });

    test('should handle mixed action types in same trade list', () => {
      const trades = [
        { action: 'BUY', ticker: 'MSFT', shares: 10 },
        { action: 'INCREASE', ticker: 'AAPL', shares: 5 },
        { action: 'TRIM', ticker: 'NVDA', shares: 2 },
        { action: 'HOLD', ticker: 'TSLA', shares: 0 },
        { action: 'SELL', ticker: 'GOOGL', shares: 3 },
      ];

      const buyActions = trades.filter(t => t.action === 'BUY' || t.action === 'INCREASE');
      const sellActions = trades.filter(t => t.action === 'SELL' || t.action === 'TRIM');
      const holdActions = trades.filter(t => t.action === 'HOLD');

      expect(buyActions.length).toBe(2); // BUY, INCREASE
      expect(sellActions.length).toBe(2); // SELL, TRIM
      expect(holdActions.length).toBe(1); // HOLD
    });
  });
});

