function safeDiv(numerator, denominator, fallback = 0) {
  if (denominator === 0 || denominator === null || denominator === undefined) {
    return fallback;
  }
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return fallback;
  }
  return numerator / denominator;
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) {
    return null;
  }
  let multiplier = 2 / (period + 1);
  let currentEma = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    currentEma = (values[i] - currentEma) * multiplier + currentEma;
  }
  return Number.isFinite(currentEma) ? currentEma : null;
}

function rsi(values, period) {
  if (!Array.isArray(values) || values.length < period + 1 || period <= 0) {
    return null;
  }
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return 100;
  }
  const rs = safeDiv(avgGain, avgLoss, null);
  if (rs === null) {
    return null;
  }
  const calculated = 100 - 100 / (1 + rs);
  return Number.isFinite(calculated) ? calculated : null;
}

function percentDiff(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return null;
  }
  return ((a - b) / b) * 100;
}

function slope(values, lookback) {
  if (!Array.isArray(values) || values.length <= lookback) {
    return null;
  }
  const latest = values[values.length - 1];
  const past = values[values.length - 1 - lookback];
  if (!Number.isFinite(latest) || !Number.isFinite(past)) {
    return null;
  }
  return latest - past;
}

module.exports = {
  safeDiv,
  ema,
  rsi,
  percentDiff,
  slope,
};
