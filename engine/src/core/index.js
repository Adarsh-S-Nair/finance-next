/**
 * Core Trading Engine Modules - ES Module Index
 * 
 * This is the single source of truth for trading logic.
 * Import from this file for all trading-related functionality.
 */

export { ENGINE_CONFIG, getEngineConfig } from './config.js';
export { ema, rsi, computeIndicators } from './indicators.js';
export { evaluateEntrySignal } from './signalEvaluator.js';
