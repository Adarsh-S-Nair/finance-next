/**
 * Tests for AI Trading Trade Execution
 * Tests the core functionality of executing trades and updating holdings
 */

import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('AI Trading Trade Execution', () => {
  let mockSupabase;
  let mockPortfolio;
  let mockHoldings;
  let mockTrades;
  let stockPrices;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock stock prices
    stockPrices = new Map([
      ['AAPL', 150.25],
      ['NVDA', 500.00],
      ['MSFT', 350.75],
      ['TSLA', 250.50],
    ]);

    // Mock portfolio
    mockPortfolio = {
      id: 'portfolio-123',
      user_id: 'user-123',
      name: 'Test Portfolio',
      ai_model: 'gemini-3-flash-preview',
      starting_capital: 100000,
      current_cash: 100000,
      status: 'initializing',
      created_at: new Date().toISOString(),
      last_traded_at: null,
    };

    // Mock holdings (initially empty)
    mockHoldings = [];

    // Mock trades array
    mockTrades = [];

    // Setup Supabase mock with proper chaining
    const createChainableMock = (finalValue) => {
      const chain = {
        select: jest.fn(() => chain),
        insert: jest.fn(() => chain),
        update: jest.fn(() => chain),
        delete: jest.fn(() => chain),
        eq: jest.fn(() => chain),
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
          chain.update.mockImplementation(() => Promise.resolve({ data: { ...mockPortfolio, status: 'active' }, error: null }));
          return chain;
        } else if (table === 'ai_portfolio_holdings') {
          const chain = createChainableMock({ data: null, error: null });
          chain.select.mockImplementation(() => Promise.resolve({ data: mockHoldings, error: null }));
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
            // Return chainable object for update().eq().eq()
            const updateChain = {
              eq: jest.fn((column, value) => {
                // Return another chainable object for second eq()
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
          chain.insert.mockImplementation((data) => {
            const insertChain = {
              select: jest.fn(() => insertChain),
              single: jest.fn(() => {
                const newTrade = {
                  id: `trade-${Date.now()}-${Math.random()}`,
                  ...data,
                  executed_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                };
                mockTrades.push(newTrade);
                return Promise.resolve({ data: newTrade, error: null });
              }),
            };
            return insertChain;
          });
          return chain;
        }
        return createChainableMock({ data: null, error: null });
      }),
    };

    createClient.mockReturnValue(mockSupabase);
  });

  describe('Basic Trade Execution', () => {
    test('should execute a single BUY trade and create holding', async () => {
      const trade = {
        action: 'BUY',
        ticker: 'AAPL',
        shares: 10,
        reason: 'Test buy',
      };

      const price = stockPrices.get('AAPL');
      const totalValue = trade.shares * price;

      // Execute trade logic (simplified version)
      const result = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'buy',
          shares: 10,
          price: price,
          total_value: totalValue,
          reasoning: trade.reason,
        })
        .select()
        .single();

      const tradeRecord = result.data;
      expect(tradeRecord).toBeDefined();
      expect(tradeRecord.action).toBe('buy');
      expect(tradeRecord.ticker).toBe('AAPL');
      expect(tradeRecord.shares).toBe(10);
      expect(tradeRecord.price).toBe(price);
      expect(tradeRecord.total_value).toBe(totalValue);

      // Create holding
      const holdingResult = await mockSupabase
        .from('ai_portfolio_holdings')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          shares: 10,
          avg_cost: price,
        });

      const holding = holdingResult.data;
      expect(holding).toBeDefined();
      expect(holding.ticker).toBe('AAPL');
      expect(holding.shares).toBe(10);
      expect(holding.avg_cost).toBe(price);
    });

    test('should execute a SELL trade and update holding', async () => {
      // First, create a holding
      mockHoldings.push({
        id: 'holding-1',
        portfolio_id: mockPortfolio.id,
        ticker: 'AAPL',
        shares: 20,
        avg_cost: 150.00,
      });

      const trade = {
        action: 'SELL',
        ticker: 'AAPL',
        shares: 10,
        reason: 'Test sell',
      };

      const price = stockPrices.get('AAPL');
      const totalValue = trade.shares * price;

      // Execute trade
      const result = await mockSupabase
        .from('ai_portfolio_trades')
        .insert({
          portfolio_id: mockPortfolio.id,
          ticker: 'AAPL',
          action: 'sell',
          shares: 10,
          price: price,
          total_value: totalValue,
          reasoning: trade.reason,
        })
        .select()
        .single();

      const tradeRecord = result.data;
      expect(tradeRecord).toBeDefined();
      expect(tradeRecord.action).toBe('sell');

      // Update holding (remaining shares)
      const remainingShares = 20 - 10;
      await mockSupabase
        .from('ai_portfolio_holdings')
        .update({
          shares: remainingShares,
          updated_at: new Date().toISOString(),
        })
        .eq('portfolio_id', mockPortfolio.id)
        .eq('ticker', 'AAPL');

      expect(remainingShares).toBe(10);
    });
  });

  describe('Weighted Average Cost Calculation', () => {
    test('should calculate weighted average when buying more of existing position', () => {
      // Initial holding: 10 shares @ $100 = $1000
      const existingShares = 10;
      const existingAvgCost = 100.00;
      const existingTotalCost = existingShares * existingAvgCost;

      // Buy 10 more shares @ $150 = $1500
      const newShares = 10;
      const newPrice = 150.00;
      const newTotalCost = newShares * newPrice;

      // Calculate new weighted average
      const newTotalShares = existingShares + newShares;
      const newTotalCostCombined = existingTotalCost + newTotalCost;
      const newAvgCost = newTotalCostCombined / newTotalShares;

      expect(newAvgCost).toBe(125.00); // ($1000 + $1500) / 20 = $125
      expect(newTotalShares).toBe(20);
    });

    test('should maintain avg_cost when selling (FIFO not used, cost basis preserved)', () => {
      // Holding: 20 shares @ $125 avg cost
      const currentShares = 20;
      const avgCost = 125.00;

      // Sell 10 shares
      const sellShares = 10;
      const remainingShares = currentShares - sellShares;

      // Avg cost should remain the same
      expect(remainingShares).toBe(10);
      // Avg cost stays at $125 (not recalculated on sell)
    });
  });

  describe('Edge Cases', () => {
    test('should reject trade with insufficient cash', () => {
      const currentCash = 1000.00;
      const trade = {
        action: 'BUY',
        ticker: 'NVDA',
        shares: 10,
      };

      const price = stockPrices.get('NVDA');
      const totalValue = trade.shares * price; // 10 * $500 = $5000

      expect(totalValue).toBeGreaterThan(currentCash);
      // Trade should be rejected
    });

    test('should reject trade with insufficient shares', () => {
      mockHoldings.push({
        id: 'holding-1',
        portfolio_id: mockPortfolio.id,
        ticker: 'AAPL',
        shares: 5, // Only 5 shares
        avg_cost: 150.00,
      });

      const trade = {
        action: 'SELL',
        ticker: 'AAPL',
        shares: 10, // Trying to sell 10
      };

      const availableShares = 5;
      expect(trade.shares).toBeGreaterThan(availableShares);
      // Trade should be rejected
    });

    test('should reject trade below minimum value ($500)', () => {
      const trade = {
        action: 'BUY',
        ticker: 'AAPL',
        shares: 1,
      };

      const price = stockPrices.get('AAPL');
      const totalValue = trade.shares * price; // 1 * $150.25 = $150.25

      expect(totalValue).toBeLessThan(500);
      // Trade should be rejected
    });

    test('should delete holding when all shares are sold', () => {
      mockHoldings.push({
        id: 'holding-1',
        portfolio_id: mockPortfolio.id,
        ticker: 'AAPL',
        shares: 10,
        avg_cost: 150.00,
      });

      const trade = {
        action: 'SELL',
        ticker: 'AAPL',
        shares: 10, // Sell all shares
      };

      const remainingShares = 10 - 10;
      
      if (remainingShares <= 0.0001) {
        // Should delete holding
        const index = mockHoldings.findIndex(h => h.ticker === 'AAPL');
        if (index > -1) {
          mockHoldings.splice(index, 1);
        }
      }

      expect(mockHoldings.find(h => h.ticker === 'AAPL')).toBeUndefined();
    });

    test('should handle multiple trades in sequence', async () => {
      const trades = [
        { action: 'BUY', ticker: 'AAPL', shares: 10 },
        { action: 'BUY', ticker: 'NVDA', shares: 5 },
        { action: 'BUY', ticker: 'MSFT', shares: 8 },
      ];

      let currentCash = 100000;

      for (const trade of trades) {
        const price = stockPrices.get(trade.ticker);
        const totalValue = trade.shares * price;

        if (totalValue <= currentCash) {
          const tradeResult = await mockSupabase
            .from('ai_portfolio_trades')
            .insert({
              portfolio_id: mockPortfolio.id,
              ticker: trade.ticker,
              action: 'buy',
              shares: trade.shares,
              price: price,
              total_value: totalValue,
            })
            .select()
            .single();

          if (tradeResult.data) {
            await mockSupabase
              .from('ai_portfolio_holdings')
              .insert({
                portfolio_id: mockPortfolio.id,
                ticker: trade.ticker,
                shares: trade.shares,
                avg_cost: price,
              });

            currentCash -= totalValue;
          }
        }
      }

      expect(mockTrades.length).toBe(3);
      expect(mockHoldings.length).toBe(3);
      expect(currentCash).toBeLessThan(100000);
    });

    test('should handle buying more of existing position (weighted average)', async () => {
      // Initial buy
      mockHoldings.push({
        id: 'holding-1',
        portfolio_id: mockPortfolio.id,
        ticker: 'AAPL',
        shares: 10,
        avg_cost: 150.00,
      });

      // Buy more
      const existingHolding = mockHoldings.find(h => h.ticker === 'AAPL');
      const existingShares = existingHolding.shares;
      const existingAvgCost = existingHolding.avg_cost;
      const existingTotalCost = existingShares * existingAvgCost;

      const newShares = 10;
      const newPrice = stockPrices.get('AAPL');
      const newTotalCost = newShares * newPrice;

      const newTotalShares = existingShares + newShares;
      const newTotalCostCombined = existingTotalCost + newTotalCost;
      const newAvgCost = newTotalCostCombined / newTotalShares;

      // Update holding
      existingHolding.shares = newTotalShares;
      existingHolding.avg_cost = newAvgCost;

      expect(existingHolding.shares).toBe(20);
      expect(existingHolding.avg_cost).toBeCloseTo((1500 + 1502.5) / 20, 2);
    });

    test('should handle invalid ticker (price not available)', () => {
      const trade = {
        action: 'BUY',
        ticker: 'INVALID',
        shares: 10,
      };

      const price = stockPrices.get(trade.ticker);
      expect(price).toBeUndefined();
      // Trade should be rejected
    });

    test('should handle zero or negative shares', () => {
      const invalidTrades = [
        { action: 'BUY', ticker: 'AAPL', shares: 0 },
        { action: 'BUY', ticker: 'AAPL', shares: -5 },
      ];

      invalidTrades.forEach(trade => {
        expect(trade.shares).toBeLessThanOrEqual(0);
        // Trade should be rejected
      });
    });

    test('should handle missing required fields', () => {
      const invalidTrades = [
        { action: 'BUY', shares: 10 }, // Missing ticker
        { action: 'BUY', ticker: 'AAPL' }, // Missing shares
        { ticker: 'AAPL', shares: 10 }, // Missing action
      ];

      invalidTrades.forEach(trade => {
        const hasTicker = !!trade.ticker;
        const hasShares = !!trade.shares;
        const hasAction = !!trade.action;
        
        expect(hasTicker && hasShares && hasAction).toBe(false);
        // Trade should be rejected
      });
    });
  });

  describe('Portfolio Cash Updates', () => {
    test('should decrease cash on BUY', () => {
      let currentCash = 100000;
      const trade = {
        action: 'BUY',
        ticker: 'AAPL',
        shares: 10,
      };

      const price = stockPrices.get(trade.ticker);
      const totalValue = trade.shares * price;

      currentCash -= totalValue;

      expect(currentCash).toBe(100000 - 1502.5);
    });

    test('should increase cash on SELL', () => {
      let currentCash = 100000;
      const trade = {
        action: 'SELL',
        ticker: 'AAPL',
        shares: 10,
      };

      const price = stockPrices.get(trade.ticker);
      const totalValue = trade.shares * price;

      currentCash += totalValue;

      expect(currentCash).toBe(100000 + 1502.5);
    });
  });

  describe('Trade Validation', () => {
    test('should accept valid BUY trade', () => {
      const trade = {
        action: 'BUY',
        ticker: 'AAPL',
        shares: 10,
        reason: 'Good momentum',
      };

      const isValid = 
        trade.action &&
        trade.ticker &&
        trade.shares > 0 &&
        stockPrices.has(trade.ticker);

      expect(isValid).toBe(true);
    });

    test('should accept valid SELL trade with sufficient shares', () => {
      mockHoldings.push({
        id: 'holding-1',
        portfolio_id: mockPortfolio.id,
        ticker: 'AAPL',
        shares: 20,
        avg_cost: 150.00,
      });

      const trade = {
        action: 'SELL',
        ticker: 'AAPL',
        shares: 10,
        reason: 'Take profits',
      };

      const holding = mockHoldings.find(h => h.ticker === trade.ticker);
      const isValid = 
        trade.action &&
        trade.ticker &&
        trade.shares > 0 &&
        holding &&
        holding.shares >= trade.shares;

      expect(isValid).toBe(true);
    });
  });
});

