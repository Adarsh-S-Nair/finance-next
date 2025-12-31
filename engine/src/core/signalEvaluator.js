/**
 * Signal Evaluator - ES Module (Source of Truth)
 * 
 * Evaluates entry signals for long-only trading strategy.
 * Used by both the Node.js engine and Next.js backtest.
 */

/**
 * Evaluate entry signal based on latest candles and indicators
 * @param {Object} params - Evaluation parameters
 * @param {Object} params.latest5mCandle - Latest closed 5-minute candle
 * @param {Object} params.latest1hCandle - Latest closed 1-hour candle
 * @param {Object} params.indicators - Indicator values from computeIndicators
 * @param {Object} params.config - Engine configuration
 * @returns {Object} { action: "BUY"|"HOLD", reason: string, debug?: Object }
 */
export function evaluateEntrySignal({ latest5mCandle, latest1hCandle, indicators, config }) {
  // Validation: Check for missing inputs
  if (!latest5mCandle || !latest1hCandle) {
    return { action: 'HOLD', reason: 'MISSING_INPUT' };
  }

  // Validate candle structure
  if (
    typeof latest5mCandle.close !== 'number' ||
    typeof latest5mCandle.open !== 'number' ||
    typeof latest1hCandle.close !== 'number'
  ) {
    return { action: 'HOLD', reason: 'MISSING_INPUT' };
  }

  // Validate indicators
  if (!indicators || !indicators.ok) {
    return { action: 'HOLD', reason: 'INDICATORS_NOT_READY' };
  }

  const { ema20_5m, rsi14_5m, ema200_1h, ema200Slope } = indicators.values;

  // Validate indicator values exist and are numbers
  if (
    typeof ema20_5m !== 'number' ||
    typeof rsi14_5m !== 'number' ||
    typeof ema200_1h !== 'number' ||
    typeof ema200Slope !== 'number' ||
    !Number.isFinite(ema20_5m) ||
    !Number.isFinite(rsi14_5m) ||
    !Number.isFinite(ema200_1h) ||
    !Number.isFinite(ema200Slope)
  ) {
    return { action: 'HOLD', reason: 'INDICATORS_NOT_READY' };
  }

  // Validate config
  if (!config || !config.strategy) {
    return { action: 'HOLD', reason: 'MISSING_INPUT' };
  }

  const { pullbackPct, rsiMin, rsiMax } = config.strategy;

  if (
    typeof pullbackPct !== 'number' ||
    typeof rsiMin !== 'number' ||
    typeof rsiMax !== 'number'
  ) {
    return { action: 'HOLD', reason: 'MISSING_INPUT' };
  }

  const close5m = latest5mCandle.close;
  const open5m = latest5mCandle.open;
  const close1h = latest1hCandle.close;

  // 1) Regime filter (1h timeframe)
  // Require price above EMA200
  if (close1h <= ema200_1h) {
    return { action: 'HOLD', reason: 'REGIME_FILTER_FAIL' };
  }

  // Require EMA200 slope > 0 (uptrend)
  if (ema200Slope <= 0) {
    return { action: 'HOLD', reason: 'REGIME_FILTER_FAIL' };
  }

  // 2) Entry trigger (5m timeframe)
  // Calculate pullback distance
  const pullbackDistancePct = Math.abs(close5m - ema20_5m) / ema20_5m;

  // Require pullback within threshold
  if (pullbackDistancePct > pullbackPct) {
    return { action: 'HOLD', reason: 'PULLBACK_FAIL' };
  }

  // Require RSI within range
  if (rsi14_5m < rsiMin || rsi14_5m > rsiMax) {
    return { action: 'HOLD', reason: 'RSI_FAIL' };
  }

  // Require green candle (close > open)
  if (close5m <= open5m) {
    return { action: 'HOLD', reason: 'CANDLE_NOT_GREEN' };
  }

  // All checks passed -> BUY signal
  return { action: 'BUY', reason: 'ENTRY_OK' };
}
