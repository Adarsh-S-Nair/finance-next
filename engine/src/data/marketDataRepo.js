const { createClient } = require('@supabase/supabase-js');
const { timeframeToMs, isClosedCandle, latestClosedCutoff, sortCandles } = require('../utils/time');

class MarketDataRepo {
  constructor(config, logger) {
    this.client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.logger = logger;
  }

  async getLatestClosedCandle(symbol, timeframe, now) {
    const result = await this.getLastNClosedCandles(symbol, timeframe, 1, now);
    const candle = result.candles[result.candles.length - 1] || null;
    return { candle, gapsDetected: result.gapsDetected };
  }

  async getLastNClosedCandles(symbol, timeframe, n, now) {
    const candles = [];
    const limit = n * 4;
    const cutoff = latestClosedCutoff(timeframe, now);
    if (!cutoff) {
      return { candles, gapsDetected: false };
    }

    try {
      const { data, error } = await this.client
        .from('crypto_candles')
        .select('product_id,timeframe,time,open,high,low,close,volume')
        .eq('product_id', symbol)
        .eq('timeframe', timeframe)
        .lt('time', cutoff.toISOString())
        .order('time', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger?.warn('Failed to fetch candles', { symbol, timeframe, error: error.message });
        return { candles, gapsDetected: false };
      }

      const dedupedMap = new Map();
      (data || []).forEach((row) => {
        const ts = new Date(row.time);
        if (!isClosedCandle(ts, timeframe, now)) {
          return;
        }
        const key = ts.getTime();
        if (!dedupedMap.has(key)) {
          dedupedMap.set(key, {
            productId: row.product_id,
            timeframe: row.timeframe,
            timestamp: ts,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: row.volume === null || row.volume === undefined ? null : Number(row.volume),
          });
        }
      });

      const deduped = Array.from(dedupedMap.values());
      const sorted = sortCandles(deduped);
      const trimmed = sorted.slice(-n);
      const gapFlag = this.#detectGaps(trimmed, timeframeToMs(timeframe));

      return { candles: trimmed, gapsDetected: gapFlag };
    } catch (err) {
      this.logger?.error('Unexpected error fetching candles', { symbol, timeframe, error: err.message });
      return { candles: [], gapsDetected: false };
    }
  }

  async getLatestTimestamp(symbol, timeframe) {
    try {
      const { data, error } = await this.client
        .from('crypto_candles')
        .select('time')
        .eq('product_id', symbol)
        .eq('timeframe', timeframe)
        .order('time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        this.logger?.warn('Failed to fetch latest timestamp', { symbol, timeframe, error: error.message });
        return null;
      }

      return data ? new Date(data.time) : null;
    } catch (err) {
      this.logger?.error('Unexpected error fetching latest timestamp', { symbol, timeframe, error: err.message });
      return null;
    }
  }

  #detectGaps(candles, timeframeMs) {
    if (!timeframeMs || candles.length < 2) {
      return false;
    }
    for (let i = 1; i < candles.length; i++) {
      const delta = candles[i].timestamp.getTime() - candles[i - 1].timestamp.getTime();
      if (delta > timeframeMs * 1.5) {
        return true;
      }
    }
    return false;
  }
}

module.exports = {
  MarketDataRepo,
};
