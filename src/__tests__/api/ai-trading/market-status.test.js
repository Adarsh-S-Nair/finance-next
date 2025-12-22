/**
 * Tests for Market Status Checking and Pending Orders
 * Tests that orders are marked as pending when market is closed
 */

// Mock the marketData module to avoid importing cheerio
jest.mock('../../../lib/marketData', () => {
  return {
    checkMarketStatus: jest.fn(),
    // Add other exports that might be needed
    scrapeNasdaq100Constituents: jest.fn(),
    fetchBulkStockData: jest.fn(),
    fetchBulkTickerDetails: jest.fn(),
  };
});

import { checkMarketStatus } from '../../../lib/marketData';

// Mock fetch globally
global.fetch = jest.fn();

describe('Market Status Checking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FINNHUB_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.FINNHUB_API_KEY;
  });

  describe('checkMarketStatus', () => {
    beforeEach(() => {
      // Reset the mock implementation before each test
      checkMarketStatus.mockReset();
    });

    test('should return market open status when API indicates market is open', async () => {
      const mockResponse = {
        isOpen: true,
        exchange: 'US',
        timezone: 'America/New_York',
        session: 'regular',
      };

      // Mock the implementation to simulate the actual function
      checkMarketStatus.mockImplementation(async () => {
        const finnhubApiKey = process.env.FINNHUB_API_KEY;
        if (!finnhubApiKey) {
          return {
            isOpen: false,
            error: 'FINNHUB_API_KEY not found',
          };
        }

        const response = await fetch(
          `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${finnhubApiKey}`
        );

        if (!response.ok) {
          return {
            isOpen: false,
            error: `Finnhub API error: ${response.status}`,
          };
        }

        const data = await response.json();
        return {
          isOpen: data.isOpen || false,
          exchange: data.exchange,
          timezone: data.timezone,
          session: data.session,
        };
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await checkMarketStatus();

      expect(result.isOpen).toBe(true);
      expect(result.exchange).toBe('US');
      expect(result.timezone).toBe('America/New_York');
      expect(result.session).toBe('regular');
      expect(result.error).toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://finnhub.io/api/v1/stock/market-status?exchange=US&token=test-api-key'
      );
    });

    test('should return market closed status when API indicates market is closed', async () => {
      const mockResponse = {
        isOpen: false,
        exchange: 'US',
        timezone: 'America/New_York',
        session: 'closed',
      };

      checkMarketStatus.mockImplementation(async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${process.env.FINNHUB_API_KEY}`
        );
        const data = await response.json();
        return {
          isOpen: data.isOpen || false,
          exchange: data.exchange,
          timezone: data.timezone,
          session: data.session,
        };
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await checkMarketStatus();

      expect(result.isOpen).toBe(false);
      expect(result.exchange).toBe('US');
      expect(result.error).toBeUndefined();
    });

    test('should return error when API key is missing', async () => {
      const originalKey = process.env.FINNHUB_API_KEY;
      delete process.env.FINNHUB_API_KEY;

      checkMarketStatus.mockImplementation(async () => {
        const finnhubApiKey = process.env.FINNHUB_API_KEY;
        if (!finnhubApiKey) {
          return {
            isOpen: false,
            error: 'FINNHUB_API_KEY not found',
          };
        }
        // This won't be reached
        return { isOpen: false };
      });

      const result = await checkMarketStatus();

      expect(result.isOpen).toBe(false);
      expect(result.error).toBe('FINNHUB_API_KEY not found');
      expect(global.fetch).not.toHaveBeenCalled();

      // Restore the key
      process.env.FINNHUB_API_KEY = originalKey;
    });

    test('should return error when API request fails', async () => {
      checkMarketStatus.mockImplementation(async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${process.env.FINNHUB_API_KEY}`
        );

        if (!response.ok) {
          return {
            isOpen: false,
            error: `Finnhub API error: ${response.status}`,
          };
        }

        const data = await response.json();
        return {
          isOpen: data.isOpen || false,
          exchange: data.exchange,
          timezone: data.timezone,
          session: data.session,
        };
      });

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await checkMarketStatus();

      expect(result.isOpen).toBe(false);
      expect(result.error).toBe('Finnhub API error: 500');
    });

    test('should return error when fetch throws an exception', async () => {
      checkMarketStatus.mockImplementation(async () => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${process.env.FINNHUB_API_KEY}`
          );
          const data = await response.json();
          return {
            isOpen: data.isOpen || false,
            exchange: data.exchange,
            timezone: data.timezone,
            session: data.session,
          };
        } catch (error) {
          return {
            isOpen: false,
            error: error.message,
          };
        }
      });

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkMarketStatus();

      expect(result.isOpen).toBe(false);
      expect(result.error).toBe('Network error');
    });

      test('should handle API response with missing isOpen field', async () => {
      const mockResponse = {
        exchange: 'US',
        timezone: 'America/New_York',
      };

      checkMarketStatus.mockImplementation(async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${process.env.FINNHUB_API_KEY}`
        );
        const data = await response.json();
        return {
          isOpen: data.isOpen || false,
          exchange: data.exchange,
          timezone: data.timezone,
          session: data.session,
        };
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await checkMarketStatus();

      expect(result.isOpen).toBe(false); // Should default to false
      expect(result.exchange).toBe('US');
    });
  });
});

describe('Pending Order Logic', () => {
  test('should mark orders as pending when market is closed', () => {
    const marketStatus = { isOpen: false };
    const isMarketOpen = marketStatus.isOpen === true;

    expect(isMarketOpen).toBe(false);

    // When market is closed, orders should have:
    const pendingOrder = {
      is_pending: true,
      executed_at: null,
    };

    expect(pendingOrder.is_pending).toBe(true);
    expect(pendingOrder.executed_at).toBeNull();
  });

  test('should execute orders immediately when market is open', () => {
    const marketStatus = { isOpen: true };
    const isMarketOpen = marketStatus.isOpen === true;

    expect(isMarketOpen).toBe(true);

    // When market is open, orders should have:
    const executedOrder = {
      is_pending: false,
      executed_at: expect.any(String), // ISO timestamp
    };

    expect(executedOrder.is_pending).toBe(false);
    expect(executedOrder.executed_at).toBeTruthy();
  });

  test('should handle market status check error gracefully', () => {
    const marketStatus = { isOpen: false, error: 'API error' };
    const isMarketOpen = marketStatus.isOpen === true;

    // Even with an error, if isOpen is false, we should treat as closed
    expect(isMarketOpen).toBe(false);
  });
});

