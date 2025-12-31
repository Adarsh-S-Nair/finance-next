/**
 * Technical Indicators - ES Module (Source of Truth)
 * 
 * Pure functions for computing EMA, RSI, and related indicators.
 * Used by both the Node.js engine and Next.js backtest.
 */

/**
 * Validate that an array contains only valid numbers
 */
function validateNumericArray(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
}

/**
 * Compute Exponential Moving Average (EMA)
 * @param {Array<number>} values - Array of numeric values
 * @param {number} period - EMA period
 * @returns {number|null} Latest EMA value, or null if insufficient data
 */
export function ema(values, period) {
  if (!validateNumericArray(values)) return null;
  if (typeof period !== 'number' || period <= 0 || !Number.isInteger(period)) return null;
  if (values.length < period) return null;

  // Calculate initial SMA for first period values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let emaValue = sum / period;

  // Calculate EMA for remaining values
  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    emaValue = (values[i] - emaValue) * multiplier + emaValue;
  }

  return emaValue;
}

/**
 * Compute Relative Strength Index (RSI)
 * @param {Array<number>} values - Array of close prices
 * @param {number} period - RSI period (typically 14)
 * @returns {number|null} RSI value (0-100), or null if insufficient data
 */
export function rsi(values, period) {
  if (!validateNumericArray(values)) return null;
  if (typeof period !== 'number' || period <= 0 || !Number.isInteger(period)) return null;
  if (values.length < period + 1) return null;

  // Calculate price changes (deltas)
  const deltas = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1]);
  }

  // Separate gains and losses
  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? Math.abs(d) : 0);

  // Calculate initial average gain and loss
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
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Extract close prices from candles
 * @param {Array} candles - Array of candle objects with 'close' property
 * @returns {Array<number>} Array of close prices
 */
function getCloses(candles) {
  return candles
    .map(c => c.close)
    .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
}

/**
 * Compute all indicators for strategy evaluation
 * @param {Object} params - Parameters
 * @param {Array} params.candles5m - Array of 5-minute candles
 * @param {Array} params.candles1h - Array of 1-hour candles
 * @param {Object} params.config - Configuration with strategy settings
 * @returns {Object} { ok: true, values: {...} } or { ok: false, reason: string }
 */
export function computeIndicators({ candles5m, candles1h, config }) {
  // Validate config
  if (!config || !config.strategy) {
    return { ok: false, reason: 'UNSAFE_INPUT' };
  }

  const { emaFast, emaSlow, rsiPeriod } = config.strategy;

  if (
    typeof emaFast !== 'number' ||
    typeof emaSlow !== 'number' ||
    typeof rsiPeriod !== 'number' ||
    emaFast <= 0 || emaSlow <= 0 || rsiPeriod <= 0
  ) {
    return { ok: false, reason: 'UNSAFE_INPUT' };
  }

  // Validate candles arrays exist
  if (!Array.isArray(candles5m) || !Array.isArray(candles1h)) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  // Extract close prices
  const closes5m = getCloses(candles5m);
  const closes1h = getCloses(candles1h);

  // Validate we have enough data
  if (closes5m.length < emaFast || closes5m.length < rsiPeriod + 1) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }
  if (closes1h.length < emaSlow) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  // Compute EMA20 on 5m candles
  const ema20_5m = ema(closes5m, emaFast);
  if (ema20_5m === null) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  // Compute RSI14 on 5m candles
  const rsi14_5m = rsi(closes5m, rsiPeriod);
  if (rsi14_5m === null) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  // Compute EMA200 on 1h candles
  const ema200_1h = ema(closes1h, emaSlow);
  if (ema200_1h === null) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  // Compute EMA200 slope (compare to k bars ago)
  const k = 3;
  if (closes1h.length - k < emaSlow) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  const closes1hPrev = closes1h.slice(0, closes1h.length - k);
  const emaPrev = ema(closes1hPrev, emaSlow);
  if (emaPrev === null) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  const ema200Slope = ema200_1h - emaPrev;

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
