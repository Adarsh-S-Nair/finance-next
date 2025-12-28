/**
 * Signal Evaluator
 * Evaluates entry signals for long-only trading strategy
 * Returns BUY or HOLD with detailed reasons
 */

/**
 * Evaluate entry signal based on latest candles and indicators
 * @param {Object} params - Evaluation parameters
 * @param {Object} params.latest5mCandle - Latest closed 5-minute candle
 * @param {Object} params.latest1hCandle - Latest closed 1-hour candle
 * @param {Object} params.indicators - Indicator values from computeIndicators
 * @param {Object} params.config - Engine configuration
 * @returns {Object} { action: "BUY"|"HOLD", reason: string, debug: Object }
 */
function evaluateEntrySignal({ latest5mCandle, latest1hCandle, indicators, config }) {
  // Initialize debug object
  const debug = {};

  // Validation: Check for missing inputs
  if (!latest5mCandle || !latest1hCandle) {
    return {
      action: "HOLD",
      reason: "MISSING_INPUT",
      debug: { latest5mCandle: !!latest5mCandle, latest1hCandle: !!latest1hCandle },
    };
  }

  // Validate candle structure
  if (
    typeof latest5mCandle.close !== "number" ||
    typeof latest5mCandle.open !== "number" ||
    typeof latest1hCandle.close !== "number"
  ) {
    return {
      action: "HOLD",
      reason: "MISSING_INPUT",
      debug: {
        latest5mCandleValid: typeof latest5mCandle.close === "number",
        latest1hCandleValid: typeof latest1hCandle.close === "number",
      },
    };
  }

  // Validate indicators
  if (!indicators || !indicators.ok) {
    return {
      action: "HOLD",
      reason: "INDICATORS_NOT_READY",
      debug: { indicatorsOk: indicators?.ok || false },
    };
  }

  const { ema20_5m, rsi14_5m, ema200_1h, ema200Slope } = indicators.values;

  // Validate indicator values exist and are numbers
  if (
    typeof ema20_5m !== "number" ||
    typeof rsi14_5m !== "number" ||
    typeof ema200_1h !== "number" ||
    typeof ema200Slope !== "number" ||
    !Number.isFinite(ema20_5m) ||
    !Number.isFinite(rsi14_5m) ||
    !Number.isFinite(ema200_1h) ||
    !Number.isFinite(ema200Slope)
  ) {
    return {
      action: "HOLD",
      reason: "INDICATORS_NOT_READY",
      debug: {
        ema20_5m: typeof ema20_5m,
        rsi14_5m: typeof rsi14_5m,
        ema200_1h: typeof ema200_1h,
        ema200Slope: typeof ema200Slope,
      },
    };
  }

  // Validate config
  if (!config || !config.strategy) {
    return {
      action: "HOLD",
      reason: "MISSING_INPUT",
      debug: { configValid: !!config, strategyValid: !!config?.strategy },
    };
  }

  const { pullbackPct, rsiMin, rsiMax } = config.strategy;

  if (
    typeof pullbackPct !== "number" ||
    typeof rsiMin !== "number" ||
    typeof rsiMax !== "number"
  ) {
    return {
      action: "HOLD",
      reason: "MISSING_INPUT",
      debug: {
        pullbackPct: typeof pullbackPct,
        rsiMin: typeof rsiMin,
        rsiMax: typeof rsiMax,
      },
    };
  }

  // Extract candle values for debug
  const close5m = latest5mCandle.close;
  const open5m = latest5mCandle.open;
  const close1h = latest1hCandle.close;

  // Populate debug object
  debug.close5m = close5m;
  debug.open5m = open5m;
  debug.ema20_5m = ema20_5m;
  debug.rsi14_5m = rsi14_5m;
  debug.close1h = close1h;
  debug.ema200_1h = ema200_1h;
  debug.ema200Slope = ema200Slope;

  // 1) Regime filter (1h timeframe)
  // Require latest1hCandle.close > indicators.ema200_1h
  if (close1h <= ema200_1h) {
    return {
      action: "HOLD",
      reason: "REGIME_FILTER_FAIL",
      debug: {
        ...debug,
        regimeCheck: "close1h <= ema200_1h",
        close1h,
        ema200_1h,
      },
    };
  }

  // Require indicators.ema200Slope > 0
  if (ema200Slope <= 0) {
    return {
      action: "HOLD",
      reason: "REGIME_FILTER_FAIL",
      debug: {
        ...debug,
        regimeCheck: "ema200Slope <= 0",
        ema200Slope,
      },
    };
  }

  // 2) Entry trigger (5m timeframe)
  // Calculate pullback distance
  const pullbackDistancePct = Math.abs(close5m - ema20_5m) / ema20_5m;
  debug.pullbackDistancePct = pullbackDistancePct;

  // Require pullbackDistancePct <= config.strategy.pullbackPct
  if (pullbackDistancePct > pullbackPct) {
    return {
      action: "HOLD",
      reason: "PULLBACK_FAIL",
      debug: {
        ...debug,
        pullbackDistancePct,
        pullbackPct,
      },
    };
  }

  // Require RSI between [config.strategy.rsiMin, config.strategy.rsiMax]
  if (rsi14_5m < rsiMin || rsi14_5m > rsiMax) {
    return {
      action: "HOLD",
      reason: "RSI_FAIL",
      debug: {
        ...debug,
        rsi14_5m,
        rsiMin,
        rsiMax,
      },
    };
  }

  // Require latest5mCandle.close > latest5mCandle.open (green candle)
  if (close5m <= open5m) {
    return {
      action: "HOLD",
      reason: "CANDLE_NOT_GREEN",
      debug: {
        ...debug,
        close5m,
        open5m,
      },
    };
  }

  // All checks passed -> BUY signal
  return {
    action: "BUY",
    reason: "ENTRY_OK",
    debug,
  };
}

module.exports = {
  evaluateEntrySignal,
};


