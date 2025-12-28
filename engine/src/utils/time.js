/**
 * Time utility functions for timeframe conversions and date operations
 */

/**
 * Convert timeframe string to milliseconds
 * @param {string} timeframe - Timeframe string (e.g., "1m", "5m", "1h", "1d")
 * @returns {number} Milliseconds for the timeframe
 * @throws {Error} If timeframe format is invalid
 */
function timeframeToMs(timeframe) {
  if (typeof timeframe !== "string") {
    throw new Error(`Invalid timeframe: expected string, got ${typeof timeframe}`);
  }

  const match = timeframe.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(
      `Invalid timeframe format: "${timeframe}". Expected format: "1m", "5m", "1h", "1d", etc.`
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (value <= 0) {
    throw new Error(`Invalid timeframe value: must be positive, got ${value}`);
  }

  const multipliers = {
    m: 60 * 1000,        // minutes to milliseconds
    h: 60 * 60 * 1000,   // hours to milliseconds
    d: 24 * 60 * 60 * 1000, // days to milliseconds
  };

  if (!multipliers[unit]) {
    throw new Error(`Invalid timeframe unit: "${unit}". Expected: m, h, or d`);
  }

  return value * multipliers[unit];
}

/**
 * Get the start of the day in UTC for a given date
 * @param {Date} date - Date to get start of day for
 * @returns {Date} Date object representing start of day in UTC
 */
function startOfDayUTC(date) {
  if (!(date instanceof Date)) {
    throw new Error(`Invalid date: expected Date object, got ${typeof date}`);
  }

  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0
  ));

  return utcDate;
}

module.exports = {
  timeframeToMs,
  startOfDayUTC,
};

