const { createClient } = require('@supabase/supabase-js');
const { MarketDataRepo } = require('../data/marketDataRepo');
const { computeIndicators } = require('../indicators/indicators');
const { RiskManager } = require('../risk/riskManager');
const { evaluateLongSignal } = require('../strategy/signalEvaluator');
const { ExecutionService } = require('../execution/executionService');
const { PositionManager } = require('../execution/positionManager');
const { EngineLogger } = require('../logging/engineLogger');

class EngineRunner {
  constructor(config) {
    this.config = config;
    this.logger = new EngineLogger();
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.marketDataRepo = new MarketDataRepo(config, this.logger);
    this.riskManager = new RiskManager(config.risk, this.logger);
    this.executionService = new ExecutionService(config, this.logger, this.riskManager);
    this.positionManager = new PositionManager(config, this.executionService, this.riskManager, this.logger);
    this.loopHandle = null;
  }

  async start() {
    this.logger.info('Starting paper trading engine', { loopIntervalMs: this.config.engine.loopIntervalMs });
    await this.runCycle();
    this.loopHandle = setInterval(() => {
      this.runCycle().catch((err) => this.logger.error('Engine loop error', { error: err.message }));
    }, this.config.engine.loopIntervalMs);
  }

  async stop() {
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
    this.logger.info('Engine stopped');
  }

  async runCycle() {
    const now = new Date();
    const portfolios = await this.#loadPortfolios();

    for (const portfolio of portfolios) {
      const state = this.executionService.ensurePortfolio(portfolio);
      const symbols = portfolio.symbols || [];
      for (const symbol of symbols) {
        await this.#evaluateSymbol({ portfolio, state, symbol, now });
      }
    }
  }

  async #evaluateSymbol({ portfolio, state, symbol, now }) {
    const signalTimeframe = this.config.engine.signalTimeframe;
    const trendTimeframe = this.config.engine.trendTimeframe;

    const candles5m = await this.marketDataRepo.getLastNClosedCandles(symbol, signalTimeframe, 210, now);
    const candles1h = await this.marketDataRepo.getLastNClosedCandles(symbol, trendTimeframe, 210, now);
    const latest5m = candles5m.candles[candles5m.candles.length - 1];
    const latest1h = candles1h.candles[candles1h.candles.length - 1];

    const equity = this.executionService.getPortfolioEquity(portfolio.id, {
      [symbol]: latest5m?.close,
    });
    state.equity = equity;

    const evaluationLog = {
      time: now.toISOString(),
      portfolioId: portfolio.id,
      symbol,
      latestCandles: {
        [signalTimeframe]: latest5m?.timestamp,
        [trendTimeframe]: latest1h?.timestamp,
      },
      gaps: {
        [signalTimeframe]: candles5m.gapsDetected,
        [trendTimeframe]: candles1h.gapsDetected,
      },
    };

    if (!latest5m) {
      this.logger.evaluation({ ...evaluationLog, stage: 'DATA_GAP', reason: 'NO_5M_CANDLE' });
      return;
    }

    const openPosition = this.executionService.getOpenPosition(portfolio.id, symbol);
    if (openPosition) {
      const decision = this.positionManager.evaluateOpenPositions({ portfolio, symbol, latestCandle: latest5m, now });
      this.logger.evaluation({ ...evaluationLog, stage: 'POSITION_MANAGEMENT', position: openPosition, decision });
      return;
    }

    if (!latest1h) {
      this.logger.evaluation({ ...evaluationLog, stage: 'DATA_GAP', reason: 'NO_1H_CANDLE' });
      return;
    }

    const riskDecision = this.riskManager.canOpenPosition(state, symbol, now, signalTimeframe);
    if (!riskDecision.allowed) {
      this.logger.evaluation({ ...evaluationLog, stage: 'RISK_BLOCK', risk: riskDecision });
      return;
    }

    const indicators = computeIndicators({
      candles5m: candles5m.candles,
      candles1h: candles1h.candles,
      slopeLookback: this.config.engine.slopeLookback,
    });

    if (!indicators.ok) {
      this.logger.evaluation({ ...evaluationLog, stage: 'INDICATORS', indicators, risk: riskDecision.risk });
      return;
    }

    const signal = evaluateLongSignal({ indicators, last5mCandle: latest5m, last1hCandle: latest1h });
    if (signal.action !== 'BUY') {
      this.logger.evaluation({ ...evaluationLog, stage: 'SIGNAL', signal, risk: riskDecision.risk });
      return;
    }

    const stopLossPct = riskDecision.risk.stopLossPct ?? this.config.risk.stopLossPct;
    const stopPrice = latest5m ? latest5m.close * (1 - stopLossPct) : null;

    if (riskDecision.risk.requireStopLoss && !stopPrice) {
      this.logger.evaluation({ ...evaluationLog, stage: 'EXECUTION_SKIP', reason: 'NO_STOP_PRICE', risk: riskDecision.risk });
      return;
    }

    const positionSize = this.riskManager.computePositionSize({
      equity,
      entryPrice: latest5m?.close,
      stopPrice,
      riskPerTradePct: riskDecision.risk.riskPerTradePct,
    });

    if (!positionSize || positionSize <= 0) {
      this.logger.evaluation({ ...evaluationLog, stage: 'EXECUTION_SKIP', reason: 'SIZE_ZERO', signal, indicators, risk: riskDecision.risk });
      return;
    }

    const execution = this.executionService.openPosition({
      portfolioId: portfolio.id,
      symbol,
      size: positionSize,
      entryPrice: latest5m.close,
      stopPrice,
      now,
    });

    this.logger.evaluation({
      ...evaluationLog,
      stage: 'EXECUTION',
      signal,
      execution,
      indicators,
      risk: riskDecision.risk,
    });
  }

  async #loadPortfolios() {
    try {
      const { data, error } = await this.supabase
        .from('portfolios')
        .select('id,name,asset_type,crypto_assets,current_cash,starting_capital,status')
        .eq('asset_type', 'crypto')
        .in('status', ['active', 'paused']);

      if (error) {
        this.logger.warn('Failed to load portfolios', { error: error.message });
        return this.config.portfolios || [];
      }

      return (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        starting_capital: Number(p.starting_capital || 0),
        current_cash: Number(p.current_cash || p.starting_capital || 0),
        symbols: Array.isArray(p.crypto_assets)
          ? p.crypto_assets.map((s) => `${String(s).toUpperCase()}-USD`)
          : [],
      }));
    } catch (err) {
      this.logger.error('Unexpected error loading portfolios', { error: err.message });
      return this.config.portfolios || [];
    }
  }
}

module.exports = {
  EngineRunner,
};
