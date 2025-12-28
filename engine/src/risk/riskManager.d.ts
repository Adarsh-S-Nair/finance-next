/**
 * Type declarations for riskManager.js
 */

export interface RiskManagerConfig {
  risk: {
    riskPerTradePct: number;
    maxOpenPositions: number;
    maxDailyNetOutflowPct: number;
    cooldownBarsAfterStop: number;
    requireStopLoss: boolean;
    feeBps: number;
    slippageBps: number;
  };
  timeframes: {
    signalTimeframe: string;
    regimeTimeframe: string;
    executionTimeframe: string;
  };
}

export interface Portfolio {
  id: string;
  equity: number;
  cash_balance: number;
}

export interface CanOpenPositionParams {
  portfolio: Portfolio;
  openPositionsCount: number;
  todayRealizedPnl: number;
  lastStopOutAt: Date | null;
  now: Date;
}

export interface CanOpenPositionResult {
  allowed: boolean;
  reason?: string;
  details?: any;
}

export interface ComputePositionSizeParams {
  equity: number;
  entryPrice: number;
  stopPrice: number;
  cashBalance?: number;
}

export interface ComputePositionSizeResult {
  ok: boolean;
  reason?: string;
  quantity?: number;
  riskDollars?: number;
  perUnitRisk?: number;
  maxAffordableQty?: number;
  details?: any;
}

export declare class RiskManager {
  constructor(config: RiskManagerConfig);
  canOpenPosition(params: CanOpenPositionParams): CanOpenPositionResult;
  computePositionSize(params: ComputePositionSizeParams): ComputePositionSizeResult;
  isDailyLossLimitHit(params: { portfolio: Portfolio; todayRealizedPnl: number }): boolean;
  isCooldownActive(params: { lastStopOutAt: Date | null; now: Date; candleDurationMs: number }): boolean;
}

