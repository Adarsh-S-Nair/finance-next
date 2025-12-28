const { ema, rsi, slope } = require('../utils/math');

function buildEmaSeries(values, period) {
  if (!Array.isArray(values) || values.length < period) {
    return [];
  }
  const series = new Array(values.length).fill(null);
  let multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  series[period - 1] = current;
  for (let i = period; i < values.length; i++) {
    current = (values[i] - current) * multiplier + current;
    series[i] = current;
  }
  return series;
}

function computeIndicators({ candles5m, candles1h, slopeLookback = 3 }) {
  const closes5m = (candles5m || []).map((c) => c.close);
  const closes1h = (candles1h || []).map((c) => c.close);

  if (closes5m.length < 20) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  const ema20 = ema(closes5m, 20);
  const rsi14 = rsi(closes5m, 14);

  let ema200 = null;
  let ema200Source = null;
  let ema200Series = [];

  if (closes1h.length >= 200) {
    ema200Source = '1h';
    ema200Series = buildEmaSeries(closes1h, 200);
  } else if (closes5m.length >= 200) {
    ema200Source = '5m';
    ema200Series = buildEmaSeries(closes5m, 200);
  }

  const validEma200 = ema200Series.filter((v) => Number.isFinite(v));
  if (validEma200.length > 0) {
    ema200 = validEma200[validEma200.length - 1];
  }

  if (!ema20 || !ema200 || !rsi14) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  if (!Number.isFinite(ema20) || !Number.isFinite(ema200) || !Number.isFinite(rsi14)) {
    return { ok: false, reason: 'UNSAFE_INPUT' };
  }

  const slopeValue = validEma200.length > slopeLookback ? slope(validEma200, slopeLookback) : null;
  if (slopeValue === null) {
    return { ok: false, reason: 'INSUFFICIENT_DATA' };
  }

  return {
    ok: true,
    values: {
      ema20,
      ema200,
      rsi: rsi14,
      ema200Slope: slopeValue,
      ema200Source,
    },
  };
}

module.exports = {
  computeIndicators,
};
