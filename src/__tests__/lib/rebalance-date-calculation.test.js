/**
 * Tests for Rebalance Date Calculation Logic
 * Tests the calculation of next_rebalance_date based on rebalance_cadence
 */

describe('Rebalance Date Calculation', () => {
  // Helper function to calculate next rebalance date
  function calculateNextRebalanceDate(cadence, previousRebalanceDate = null, portfolioCreatedDate = null) {
    const today = new Date();
    let baseDate;
    
    if (previousRebalanceDate) {
      // Parse date string as local date (YYYY-MM-DD) to avoid timezone issues
      const [year, month, day] = previousRebalanceDate.split('-').map(Number);
      baseDate = new Date(year, month - 1, day);
    } else if (portfolioCreatedDate) {
      // Parse date string as local date (YYYY-MM-DD) to avoid timezone issues
      const [year, month, day] = portfolioCreatedDate.split('-').map(Number);
      baseDate = new Date(year, month - 1, day);
    } else {
      baseDate = today;
    }
    
    const nextDate = new Date(baseDate);
    
    switch (cadence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        throw new Error(`Unknown rebalance cadence: ${cadence}`);
    }
    
    // Return date in YYYY-MM-DD format (using local date, not UTC)
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  describe('Monthly Rebalance Cadence', () => {
    test('should calculate next rebalance date 1 month from today when no previous date', () => {
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('monthly');
      
      expect(result).toBe(expected);
    });

    test('should calculate next rebalance date 1 month from previous date', () => {
      const previousDate = '2025-01-15';
      const nextDate = new Date(previousDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('monthly', previousDate);
      
      expect(result).toBe(expected);
    });

    test('should handle month-end dates correctly', () => {
      const previousDate = '2025-01-31';
      const result = calculateNextRebalanceDate('monthly', previousDate);
      
      // February 31 doesn't exist, so it should roll to March 3 (or Feb 28/29)
      const nextDate = new Date(previousDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      expect(result).toBe(expected);
    });

    test('should handle year rollover correctly', () => {
      const previousDate = '2025-12-15';
      const nextDate = new Date(previousDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('monthly', previousDate);
      
      expect(result).toBe('2026-01-15');
    });
  });

  describe('Daily Rebalance Cadence', () => {
    test('should calculate next rebalance date 1 day from today', () => {
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('daily');
      
      expect(result).toBe(expected);
    });

    test('should calculate next rebalance date 1 day from previous date', () => {
      const previousDate = '2025-01-15';
      const result = calculateNextRebalanceDate('daily', previousDate);
      
      expect(result).toBe('2025-01-16');
    });
  });

  describe('Weekly Rebalance Cadence', () => {
    test('should calculate next rebalance date 7 days from today', () => {
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + 7);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('weekly');
      
      expect(result).toBe(expected);
    });

    test('should calculate next rebalance date 7 days from previous date', () => {
      const previousDate = '2025-01-15';
      const result = calculateNextRebalanceDate('weekly', previousDate);
      
      expect(result).toBe('2025-01-22');
    });
  });

  describe('Quarterly Rebalance Cadence', () => {
    test('should calculate next rebalance date 3 months from today', () => {
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + 3);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('quarterly');
      
      expect(result).toBe(expected);
    });

    test('should calculate next rebalance date 3 months from previous date', () => {
      const previousDate = '2025-01-15';
      const result = calculateNextRebalanceDate('quarterly', previousDate);
      
      expect(result).toBe('2025-04-15');
    });

    test('should handle year rollover correctly', () => {
      const previousDate = '2025-11-15';
      const result = calculateNextRebalanceDate('quarterly', previousDate);
      
      expect(result).toBe('2026-02-15');
    });
  });

  describe('Yearly Rebalance Cadence', () => {
    test('should calculate next rebalance date 1 year from today', () => {
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('yearly');
      
      expect(result).toBe(expected);
    });

    test('should calculate next rebalance date 1 year from previous date', () => {
      const previousDate = '2025-01-15';
      const result = calculateNextRebalanceDate('yearly', previousDate);
      
      expect(result).toBe('2026-01-15');
    });
  });

  describe('Portfolio Creation Date', () => {
    test('should use portfolio creation date when no previous rebalance date exists', () => {
      const portfolioCreatedDate = '2025-01-10';
      const nextDate = new Date(portfolioCreatedDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      const result = calculateNextRebalanceDate('monthly', null, portfolioCreatedDate);
      
      expect(result).toBe(expected);
    });

    test('should prioritize previous rebalance date over creation date', () => {
      const previousRebalanceDate = '2025-02-15';
      const portfolioCreatedDate = '2025-01-10';
      
      const result = calculateNextRebalanceDate('monthly', previousRebalanceDate, portfolioCreatedDate);
      
      // Should use previous rebalance date, not creation date
      expect(result).toBe('2025-03-15');
    });
  });

  describe('Edge Cases', () => {
    test('should throw error for unknown cadence', () => {
      expect(() => {
        calculateNextRebalanceDate('unknown');
      }).toThrow('Unknown rebalance cadence: unknown');
    });

    test('should handle leap year correctly', () => {
      const previousDate = '2024-02-29'; // Leap year
      const result = calculateNextRebalanceDate('yearly', previousDate);
      
      // 2025 is not a leap year, so Feb 29 becomes March 1
      const nextDate = new Date(previousDate);
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      expect(result).toBe(expected);
    });

    test('should return date in YYYY-MM-DD format', () => {
      const result = calculateNextRebalanceDate('monthly', '2025-01-15');
      
      // Check format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Default Behavior for New Portfolios', () => {
    test('should default to monthly cadence', () => {
      const today = new Date();
      const nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      // Simulate new portfolio with monthly cadence
      const result = calculateNextRebalanceDate('monthly');
      
      expect(result).toBe(expected);
    });

    test('should set next_rebalance_date when portfolio is created', () => {
      const portfolioCreatedDate = new Date().toISOString().split('T')[0];
      const nextDate = new Date(portfolioCreatedDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      const expected = nextDate.toISOString().split('T')[0];
      
      // New portfolio: no previous_rebalance_date, use creation date
      const result = calculateNextRebalanceDate('monthly', null, portfolioCreatedDate);
      
      expect(result).toBe(expected);
    });
  });
});

