function evaluateLongSignal({ indicators, last5mCandle, last1hCandle }) {
  if (!indicators || !indicators.ok) {
    return { action: 'HOLD', reason: indicators?.reason || 'NO_INDICATORS', debug: indicators || {} };
  }

  if (!last5mCandle || !last1hCandle) {
    return { action: 'HOLD', reason: 'MISSING_CANDLE', debug: indicators.values };
  }

  const { ema20, ema200, rsi, ema200Slope, ema200Source } = indicators.values;
  if (!ema200 || !Number.isFinite(ema200Slope)) {
    return { action: 'HOLD', reason: 'MISSING_TREND', debug: indicators.values };
  }

  if (!(last1hCandle.close > ema200 && ema200Slope > 0)) {
    return { action: 'HOLD', reason: 'TREND_FILTER_FAIL', debug: indicators.values };
  }

  const nearEma20 = Math.abs(last5mCandle.close - ema20) / ema20 <= 0.003;
  const rsiOk = rsi >= 40 && rsi <= 55;
  const candleGreen = last5mCandle.close > last5mCandle.open;

  if (nearEma20 && rsiOk && candleGreen) {
    return {
      action: 'BUY',
      reason: 'ENTRY_CONDITIONS_MET',
      debug: { ...indicators.values, ema200Source },
    };
  }

  return {
    action: 'HOLD',
    reason: 'ENTRY_FILTER_FAIL',
    debug: { ...indicators.values, ema200Source },
  };
}

module.exports = {
  evaluateLongSignal,
};
