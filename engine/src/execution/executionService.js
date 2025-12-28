const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const { startOfUtcDay } = require('../utils/time');

class ExecutionService {
  constructor(config, logger, riskManager) {
    this.config = config.execution;
    this.logger = logger;
    this.riskManager = riskManager;
    this.client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.portfolioState = new Map();
  }

  ensurePortfolio(portfolio) {
    if (!this.portfolioState.has(portfolio.id)) {
      this.portfolioState.set(portfolio.id, {
        id: portfolio.id,
        name: portfolio.name,
        cash: Number(portfolio.current_cash || portfolio.starting_capital || 0),
        equity: Number(portfolio.current_cash || portfolio.starting_capital || 0),
        openPositions: [],
        realizedPnl: 0,
        dayKey: startOfUtcDay(new Date()).toISOString(),
        riskOverrides: portfolio.riskOverrides || {},
      });
    }
    return this.portfolioState.get(portfolio.id);
  }

  getPortfolioState(portfolioId) {
    return this.portfolioState.get(portfolioId);
  }

  getOpenPosition(portfolioId, symbol) {
    const state = this.portfolioState.get(portfolioId);
    if (!state) return null;
    return state.openPositions.find((p) => p.symbol === symbol) || null;
  }

  getPortfolioEquity(portfolioId, latestPriceMap = {}) {
    const state = this.portfolioState.get(portfolioId);
    if (!state) return 0;
    let equity = state.cash;
    state.openPositions.forEach((pos) => {
      const mark = latestPriceMap[pos.symbol];
      const price = Number.isFinite(mark) ? mark : pos.entryPrice;
      equity += price * pos.size;
    });
    state.equity = equity;
    return equity;
  }

  openPosition({ portfolioId, symbol, size, entryPrice, stopPrice, now }) {
    if (!stopPrice) {
      return { ok: false, reason: 'MISSING_STOP' };
    }
    const state = this.portfolioState.get(portfolioId);
    if (!state) {
      return { ok: false, reason: 'UNKNOWN_PORTFOLIO' };
    }

    const slippage = this.config.slippageBps / 10000;
    const feeRate = this.config.feeBps / 10000;
    const fillPrice = entryPrice * (1 + slippage);
    const cost = fillPrice * size;
    const fee = cost * feeRate;
    const takeProfitPrice = entryPrice + 2 * (entryPrice - stopPrice);

    if (cost + fee > state.cash) {
      return { ok: false, reason: 'INSUFFICIENT_CASH' };
    }

    const position = {
      id: randomUUID(),
      symbol,
      size,
      entryPrice: fillPrice,
      entryFee: fee,
      stopPrice,
      takeProfitPrice,
      highestClose: fillPrice,
      trailActive: false,
      trailStop: null,
      openedAt: now,
    };

    state.cash -= cost + fee;
    state.openPositions.push(position);

    this.#persistPosition({ ...position, portfolio_id: portfolioId, status: 'OPEN' });
    this.#persistTrade({
      id: randomUUID(),
      portfolio_id: portfolioId,
      position_id: position.id,
      symbol,
      side: 'BUY',
      price: fillPrice,
      size,
      fee,
      executed_at: now.toISOString(),
    });

    this.logger?.info('Opened paper position', { portfolioId, symbol, size, fillPrice, stopPrice, takeProfitPrice });
    return { ok: true, position };
  }

  closePosition({ portfolioId, positionId, exitPrice, reason, now }) {
    const state = this.portfolioState.get(portfolioId);
    if (!state) {
      return { ok: false, reason: 'UNKNOWN_PORTFOLIO' };
    }
    const positionIndex = state.openPositions.findIndex((p) => p.id === positionId);
    if (positionIndex === -1) {
      return { ok: false, reason: 'POSITION_NOT_FOUND' };
    }
    const position = state.openPositions[positionIndex];
    const slippage = this.config.slippageBps / 10000;
    const feeRate = this.config.feeBps / 10000;
    const fillPrice = exitPrice * (1 - slippage);
    const proceeds = fillPrice * position.size;
    const fee = proceeds * feeRate;
    const grossPnl = (fillPrice - position.entryPrice) * position.size;
    const netPnl = grossPnl - position.entryFee - fee;

    state.cash += proceeds - fee;
    state.openPositions.splice(positionIndex, 1);

    if (state.dayKey !== startOfUtcDay(now).toISOString()) {
      state.dayKey = startOfUtcDay(now).toISOString();
      state.realizedPnl = 0;
    }
    state.realizedPnl += netPnl;
    this.riskManager?.trackRealizedPnl(portfolioId, netPnl, now);

    this.#persistPosition({ ...position, portfolio_id: portfolioId, status: 'CLOSED', closed_at: now.toISOString(), exit_price: fillPrice, exit_reason: reason, pnl: netPnl });
    this.#persistTrade({
      id: randomUUID(),
      portfolio_id: portfolioId,
      position_id: positionId,
      symbol: position.symbol,
      side: 'SELL',
      price: fillPrice,
      size: position.size,
      fee,
      executed_at: now.toISOString(),
      reason,
    });

    this.logger?.info('Closed paper position', { portfolioId, symbol: position.symbol, reason, fillPrice, netPnl });
    return { ok: true, netPnl, reason, fillPrice };
  }

  #persistPosition(payload) {
    if (!this.client) return;
    this.client.from('paper_positions').upsert(payload).then(({ error }) => {
      if (error) {
        this.logger?.warn('Failed to persist paper position', { error: error.message });
      }
    }).catch((err) => {
      this.logger?.warn('Unexpected error persisting position', { error: err.message });
    });
  }

  #persistTrade(payload) {
    if (!this.client) return;
    this.client.from('paper_trades').insert(payload).then(({ error }) => {
      if (error) {
        this.logger?.warn('Failed to persist paper trade', { error: error.message });
      }
    }).catch((err) => {
      this.logger?.warn('Unexpected error persisting trade', { error: err.message });
    });
  }
}

module.exports = {
  ExecutionService,
};
