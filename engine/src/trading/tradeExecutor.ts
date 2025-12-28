/**
 * Trade Executor
 * Executes trades based on engine signals
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { RiskManager } from '../risk/riskManager';

interface ExecuteTradeParams {
  supabaseClient: SupabaseClient;
  portfolioId: string;
  symbol: string;
  entryPrice: number;
  stopPrice: number;
  equity: number;
  cashBalance: number;
  config: any;
  reasoning: string;
}

interface TradeResult {
  ok: boolean;
  reason?: string;
  tradeId?: string;
  quantity?: number;
  totalValue?: number;
}

/**
 * Execute a BUY trade
 */
export async function executeBuyTrade({
  supabaseClient,
  portfolioId,
  symbol,
  entryPrice,
  stopPrice,
  equity,
  cashBalance,
  config,
  reasoning,
}: ExecuteTradeParams): Promise<TradeResult> {
  try {
    // Calculate position size using risk manager
    const riskManager = new RiskManager(config);
    const positionSizeResult = riskManager.computePositionSize({
      equity,
      entryPrice,
      stopPrice,
      cashBalance,
    });

    if (!positionSizeResult.ok) {
      return {
        ok: false,
        reason: `Position sizing failed: ${positionSizeResult.reason}`,
      };
    }

    if (!positionSizeResult.quantity) {
      return {
        ok: false,
        reason: `Position sizing failed: missing quantity`,
      };
    }

    const { quantity } = positionSizeResult;
    const totalValue = quantity * entryPrice;

    // Check if we have enough cash
    if (totalValue > cashBalance) {
      return {
        ok: false,
        reason: `Insufficient cash. Need $${totalValue.toFixed(2)}, have $${cashBalance.toFixed(2)}`,
      };
    }

    // Check minimum trade value (e.g., $10)
    if (totalValue < 10) {
      return {
        ok: false,
        reason: `Trade value $${totalValue.toFixed(2)} is below minimum $10`,
      };
    }

    // Insert order record
    const { data: orderRecord, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        portfolio_id: portfolioId,
        ticker: symbol,
        action: 'buy',
        shares: quantity,
        price: entryPrice,
        total_value: totalValue,
        reasoning: reasoning,
        source: 'engine',
        is_pending: false,
        executed_at: new Date().toISOString(),
        meta: {
          stop_loss_price: stopPrice,
          entry_reason: reasoning,
        },
      })
      .select()
      .single();

    if (orderError) {
      return {
        ok: false,
        reason: `Failed to record order: ${orderError.message}`,
      };
    }

    // Create trade record for crypto trading portfolios
    // This creates an "open" trade that will be closed when the exit order is executed
    const { data: tradeRecord, error: createTradeError } = await supabaseClient
      .from('trades')
      .insert({
        portfolio_id: portfolioId,
        entry_order_id: orderRecord.id,
        exit_order_id: null,
        ticker: symbol,
        quantity: quantity,
        entry_price: entryPrice,
        exit_price: null,
        realized_pnl: null,
        hold_duration: null,
        status: 'open',
        closed_at: null,
      })
      .select()
      .single();

    // Log error but don't fail the order creation if trade creation fails
    if (createTradeError) {
      console.error(`Failed to create trade record: ${createTradeError.message}`);
    }

    // Get existing holding
    const { data: existingHolding } = await supabaseClient
      .from('holdings')
      .select('shares, avg_cost')
      .eq('portfolio_id', portfolioId)
      .eq('ticker', symbol)
      .single();

    if (existingHolding) {
      // Update existing holding - calculate new average cost
      const existingShares = parseFloat(existingHolding.shares);
      const existingCost = parseFloat(existingHolding.avg_cost);
      const existingTotalCost = existingShares * existingCost;
      const newTotalCost = existingTotalCost + totalValue;
      const newTotalShares = existingShares + quantity;
      const newAvgCost = newTotalCost / newTotalShares;

      const { error: updateError } = await supabaseClient
        .from('holdings')
        .update({
          shares: newTotalShares,
          avg_cost: newAvgCost,
          updated_at: new Date().toISOString(),
        })
        .eq('portfolio_id', portfolioId)
        .eq('ticker', symbol);

      if (updateError) {
        return {
          ok: false,
          reason: `Failed to update holding: ${updateError.message}`,
        };
      }
    } else {
      // Create new holding
      const { error: insertError } = await supabaseClient
        .from('holdings')
        .insert({
          portfolio_id: portfolioId,
          ticker: symbol,
          shares: quantity,
          avg_cost: entryPrice,
        });

      if (insertError) {
        return {
          ok: false,
          reason: `Failed to create holding: ${insertError.message}`,
        };
      }
    }

    // Update portfolio cash balance
    const newCashBalance = cashBalance - totalValue;
    const { error: cashError } = await supabaseClient
      .from('portfolios')
      .update({
        current_cash: newCashBalance,
        last_traded_at: new Date().toISOString(),
      })
      .eq('id', portfolioId);

    if (cashError) {
      return {
        ok: false,
        reason: `Failed to update cash balance: ${cashError.message}`,
      };
    }

    return {
      ok: true,
      tradeId: orderRecord.id,
      quantity,
      totalValue,
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: `Trade execution error: ${error.message || String(error)}`,
    };
  }
}

