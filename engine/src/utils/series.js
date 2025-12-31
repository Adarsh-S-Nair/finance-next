/**
 * Series utility functions for working with candle arrays and numeric data
 */

/**
 * Extract close prices from candles array
 * @param {Array} candles - Array of candle objects with close property
 * @returns {Array<number>} Array of close prices
 */
function getCloses(candles) {
  if (!Array.isArray(candles)) {
    return [];
  }

  return candles
    .filter((candle) => candle && typeof candle.close === "number" && !Number.isNaN(candle.close))
    .map((candle) => candle.close);
}

/**
 * Ensure candles are sorted in ascending order by timestamp
 * @param {Array} candles - Array of candle objects with timestamp property
 * @returns {Array} Sorted candles array (oldest first)
 */
function ensureSortedAsc(candles) {
  if (!Array.isArray(candles)) {
    return [];
  }

  return candles
    .filter((candle) => candle && candle.timestamp)
    .map((candle) => ({
      candle,
      ts: candle.timestamp instanceof Date
        ? candle.timestamp.getTime()
        : new Date(candle.timestamp).getTime(),
    }))
    .filter((item) => !Number.isNaN(item.ts))
    .sort((a, b) => a.ts - b.ts)
    .map((item) => item.candle);
}

/**
 * Validate that an array contains only valid numeric values
 * @param {Array} values - Array to validate
 * @returns {boolean} True if array is valid and contains only numbers
 */
function validateNumericArray(values) {
  if (!Array.isArray(values)) {
    return false;
  }

  if (values.length === 0) {
    return false;
  }

  // Check that all values are finite numbers
  return values.every(
    (value) => typeof value === "number" && Number.isFinite(value) && !Number.isNaN(value)
  );
}

module.exports = {
  getCloses,
  ensureSortedAsc,
  validateNumericArray,
};




