/**
 * Technical Indicators Service
 * Pure functions for computing EMA, RSI, and other indicators
 */

const { getCloses, ensureSortedAsc, validateNumericArray } = require("../utils/series");
const { detectGaps } = require("../utils/candles");
const { timeframeToMs } = require("../utils/time");

/**
 * Compute Exponential Moving Average (EMA)
 * @param {Array<number>} values - Array of numeric values
 * @param {number} period - EMA period
 * @returns {number|null} Latest EMA value, or null if insufficient data or invalid input
 */
function ema(values, period) {
  if (!validateNumericArray(values)) {
    return null;
  }

  if (typeof period !== "number" || period <= 0 || !Number.isInteger(period)) {
    return null;
  }

  if (values.length < period) {
    return null;
  }

  // EMA calculation: EMA = (Price - EMA_prev) * (2 / (Period + 1)) + EMA_prev
  // For the first value, use SMA
  let emaValue = 0;

  // Calculate initial SMA for first period values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  emaValue = sum / period;

  // Calculate EMA for remaining values
  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    emaValue = (values[i] - emaValue) * multiplier + emaValue;
  }

  return emaValue;
}

/**
 * Compute Relative Strength Index (RSI)
 * Classic RSI using close-to-close deltas
 * @param {Array<number>} values - Array of close prices
 * @param {number} period - RSI period (typically 14)
 * @returns {number|null} RSI value (0-100), or null if insufficient data or invalid input
 */
function rsi(values, period) {
  if (!validateNumericArray(values)) {
    return null;
  }

  if (typeof period !== "number" || period <= 0 || !Number.isInteger(period)) {
    return null;
  }

  // Need at least period + 1 values to compute deltas
  if (values.length < period + 1) {
    return null;
  }

  // Calculate price changes (deltas)
  const deltas = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1]);
  }

  // Separate gains and losses
  const gains = deltas.map((delta) => (delta > 0 ? delta : 0));
  const losses = deltas.map((delta) => (delta < 0 ? Math.abs(delta) : 0));

  // Calculate initial average gain and average loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }

  avgGain = avgGain / period;
  avgLoss = avgLoss / period;

  // Calculate smoothed averages for remaining periods
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  // Calculate RSI
  if (avgLoss === 0) {
    return 100; // All gains, no losses
  }

  const rs = avgGain / avgLoss;
  const rsiValue = 100 - 100 / (1 + rs);

  return rsiValue;
}

/**
 * Compute all indicators for strategy evaluation
 * @param {Object} params - Parameters
 * @param {Array} params.candles5m - Array of 5-minute candles
 * @param {Array} params.candles1h - Array of 1-hour candles
 * @param {Object} params.config - Configuration with strategy settings
 * @param {boolean} params.hasGap5m - Optional flag indicating if 5m candles have gaps
 * @param {boolean} params.hasGap1h - Optional flag indicating if 1h candles have gaps
 * @returns {Object} { ok: true, values: {...} } or { ok: false, reason: string }
 */
function computeIndicators({ candles5m, candles1h, config, hasGap5m, hasGap1h }) {
  // Validate config
  if (!config || !config.strategy) {
    return { ok: false, reason: "UNSAFE_INPUT" };
  }

  const { emaFast, emaSlow, rsiPeriod } = config.strategy;

  if (
    typeof emaFast !== "number" ||
    typeof emaSlow !== "number" ||
    typeof rsiPeriod !== "number" ||
    emaFast <= 0 ||
    emaSlow <= 0 ||
    rsiPeriod <= 0
  ) {
    return { ok: false, reason: "UNSAFE_INPUT" };
  }

  // Validate candles arrays exist
  if (!Array.isArray(candles5m) || !Array.isArray(candles1h)) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  // Ensure candles are sorted ASC by timestamp
  const sorted5m = ensureSortedAsc(candles5m);
  const sorted1h = ensureSortedAsc(candles1h);

  // Check if sorting changed anything (indicates unsorted input)
  if (sorted5m.length !== candles5m.length || sorted1h.length !== candles1h.length) {
    // Some candles were invalid, but we'll proceed with sorted ones
  }

  // Detect gaps if flags not provided
  let gap5m = hasGap5m;
  let gap1h = hasGap1h;

  if (gap5m === undefined && sorted5m.length > 1) {
    const gapInfo5m = detectGaps(sorted5m, timeframeToMs("5m"));
    gap5m = gapInfo5m.hasGap;
  }

  if (gap1h === undefined && sorted1h.length > 1) {
    const gapInfo1h = detectGaps(sorted1h, timeframeToMs("1h"));
    gap1h = gapInfo1h.hasGap;
  }

  // Return error if gaps detected
  if (gap5m || gap1h) {
    return { ok: false, reason: "GAP_DETECTED" };
  }

  // Extract close prices
  const closes5m = getCloses(sorted5m);
  const closes1h = getCloses(sorted1h);

  // Validate we have enough data
  if (closes5m.length < emaFast || closes5m.length < rsiPeriod + 1) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  if (closes1h.length < emaSlow) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  // Compute EMA20 on 5m candles
  const ema20_5m = ema(closes5m, emaFast);
  if (ema20_5m === null) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  // Compute RSI14 on 5m candles
  const rsi14_5m = rsi(closes5m, rsiPeriod);
  if (rsi14_5m === null) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  // Compute EMA200 on 1h candles
  const ema200_1h = ema(closes1h, emaSlow);
  if (ema200_1h === null) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  // Compute EMA200 slope
  // Calculate EMA at "now" and "k bars ago" (k=3 by default)
  const k = 3;
  if (closes1h.length - k < emaSlow) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  // EMA at "now" (using all available data)
  const emaNow = ema200_1h; // Already computed above

  // EMA at "k bars ago" (use subset of data ending k bars before the end)
  const closes1hPrev = closes1h.slice(0, closes1h.length - k);
  const emaPrev = ema(closes1hPrev, emaSlow);
  if (emaPrev === null) {
    return { ok: false, reason: "INSUFFICIENT_DATA" };
  }

  const ema200Slope = emaNow - emaPrev;

  return {
    ok: true,
    values: {
      ema20_5m,
      rsi14_5m,
      ema200_1h,
      ema200Slope,
    },
  };
}

module.exports = {
  ema,
  rsi,
  computeIndicators,
};

