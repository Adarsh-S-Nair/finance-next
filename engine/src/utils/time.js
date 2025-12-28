const TIMEFRAME_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

function timeframeToMs(timeframe) {
  return TIMEFRAME_MS[timeframe] || null;
}

function isClosedCandle(timestamp, timeframe, now) {
  const length = timeframeToMs(timeframe);
  if (!length) return false;
  return timestamp.getTime() < now.getTime() - length;
}

function latestClosedCutoff(timeframe, now) {
  const length = timeframeToMs(timeframe);
  if (!length) return null;
  return new Date(now.getTime() - length);
}

function sortCandles(candles) {
  return [...candles].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function startOfUtcDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

module.exports = {
  timeframeToMs,
  isClosedCandle,
  latestClosedCutoff,
  sortCandles,
  startOfUtcDay,
};
