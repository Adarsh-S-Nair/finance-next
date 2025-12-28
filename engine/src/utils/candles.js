/**
 * Candle utility functions for deduplication, sorting, and gap detection
 */

/**
 * Deduplicate candles by timestamp, keeping the last occurrence
 * @param {Array} candles - Array of candle objects with timestamp property
 * @returns {Array} Deduplicated candles array
 */
function dedupeCandlesByTimestamp(candles) {
  if (!Array.isArray(candles)) {
    return [];
  }

  // Create a map with timestamp as key, keeping the last occurrence
  const candleMap = new Map();

  for (const candle of candles) {
    if (!candle || !candle.timestamp) {
      continue;
    }

    // Normalize timestamp to a comparable value (ISO string or Date)
    const tsKey = candle.timestamp instanceof Date
      ? candle.timestamp.getTime()
      : new Date(candle.timestamp).getTime();

    if (!Number.isNaN(tsKey)) {
      candleMap.set(tsKey, candle);
    }
  }

  return Array.from(candleMap.values());
}

/**
 * Sort candles in ascending order by timestamp
 * @param {Array} candles - Array of candle objects with timestamp property
 * @returns {Array} Sorted candles array (oldest first)
 */
function sortCandlesAsc(candles) {
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
 * Detect gaps in candle series
 * A gap is defined as consecutive candles with timestamp difference > timeframeMs * 1.5
 * @param {Array} candles - Array of sorted candle objects with timestamp property
 * @param {number} timeframeMs - Expected timeframe duration in milliseconds
 * @returns {Object} { hasGap: boolean, gapCount: number }
 */
function detectGaps(candles, timeframeMs) {
  if (!Array.isArray(candles) || candles.length < 2) {
    return { hasGap: false, gapCount: 0 };
  }

  if (typeof timeframeMs !== "number" || timeframeMs <= 0) {
    return { hasGap: false, gapCount: 0 };
  }

  const sorted = sortCandlesAsc(candles);
  if (sorted.length < 2) {
    return { hasGap: false, gapCount: 0 };
  }

  const gapThreshold = timeframeMs * 1.5;
  let gapCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevCandle = sorted[i - 1];
    const currCandle = sorted[i];

    if (!prevCandle || !currCandle) {
      continue;
    }

    const prevTs = prevCandle.timestamp instanceof Date
      ? prevCandle.timestamp.getTime()
      : new Date(prevCandle.timestamp).getTime();

    const currTs = currCandle.timestamp instanceof Date
      ? currCandle.timestamp.getTime()
      : new Date(currCandle.timestamp).getTime();

    if (Number.isNaN(prevTs) || Number.isNaN(currTs)) {
      continue;
    }

    const timeDiff = currTs - prevTs;

    if (timeDiff > gapThreshold) {
      gapCount++;
    }
  }

  return {
    hasGap: gapCount > 0,
    gapCount,
  };
}

module.exports = {
  dedupeCandlesByTimestamp,
  sortCandlesAsc,
  detectGaps,
};

