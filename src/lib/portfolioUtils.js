/**
 * Portfolio Utility Functions
 * Functions for calculating portfolio values, snapshots, etc.
 */

/**
 * Calculate portfolio total value from cash and holdings
 * Uses current market prices when available, falls back to avg_cost
 * 
 * @param {number} cash - Current cash in portfolio
 * @param {Array} holdings - Array of holdings with { ticker, shares, avg_cost }
 * @param {Object} stockQuotes - Map of ticker to { price } (optional, for current market prices)
 * @returns {Object} Object with { totalValue, cash, holdingsValue }
 */
export function calculatePortfolioValue(cash, holdings = [], stockQuotes = {}) {
  const cashValue = parseFloat(cash) || 0;
  
  // Calculate holdings value using current market prices when available
  // Fall back to avg_cost if no quote is available
  let holdingsValue = 0;
  if (holdings && holdings.length > 0) {
    holdingsValue = holdings.reduce((sum, holding) => {
      const shares = parseFloat(holding.shares) || 0;
      const ticker = (holding.ticker || '').toUpperCase();
      const quote = stockQuotes[ticker];
      
      // Use current market price if available, otherwise fall back to avg_cost
      const currentPrice = quote?.price || parseFloat(holding.avg_cost) || 0;
      return sum + (shares * currentPrice);
    }, 0);
  }
  
  const totalValue = cashValue + holdingsValue;
  
  return {
    totalValue,
    cash: cashValue,
    holdingsValue,
  };
}

/**
 * Format date as YYYY-MM-DD string (local date, not UTC)
 * @param {Date} date - Date object (defaults to today)
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function formatDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

