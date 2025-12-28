/**
 * Portfolio State Repository
 * Reads portfolio state from database (portfolios, holdings, trades)
 */

const { startOfDayUTC } = require("../utils/time");

/**
 * Portfolio State Repository class
 */
class PortfolioStateRepository {
  /**
   * @param {Object} supabaseClient - Supabase client instance
   */
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("PortfolioStateRepository requires a Supabase client");
    }
    this.client = supabaseClient;
  }

  /**
   * Get portfolio by ID
   * @param {Object} params - Parameters
   * @param {string} params.portfolioId - Portfolio ID
   * @returns {Promise<Object>} { ok: true, portfolio } or { ok: false, reason }
   */
  async getPortfolioById({ portfolioId }) {
    try {
      if (!portfolioId || typeof portfolioId !== "string") {
        return { ok: false, reason: "INVALID_PORTFOLIO_ID" };
      }

      const { data, error } = await this.client
        .from("portfolios")
        .select("id, current_cash, starting_capital, last_traded_at, status, asset_type")
        .eq("id", portfolioId)
        .single();

      if (error) {
        // Handle not found (PGRST116)
        if (error.code === "PGRST116") {
          return { ok: false, reason: "PORTFOLIO_NOT_FOUND" };
        }
        return { ok: false, reason: "DB_ERROR" };
      }

      if (!data) {
        return { ok: false, reason: "PORTFOLIO_NOT_FOUND" };
      }

      const currentCash = parseFloat(data.current_cash);
      const startingCapital = parseFloat(data.starting_capital);

      return {
        ok: true,
        portfolio: {
          id: data.id,
          current_cash: Number.isFinite(currentCash) ? currentCash : 0,
          starting_capital: Number.isFinite(startingCapital) ? startingCapital : 0,
          last_traded_at: data.last_traded_at ? new Date(data.last_traded_at) : null,
          status: data.status,
          asset_type: data.asset_type,
        },
      };
    } catch (error) {
      return { ok: false, reason: "DB_ERROR" };
    }
  }

  /**
   * Get open holdings for a portfolio
   * @param {Object} params - Parameters
   * @param {string} params.portfolioId - Portfolio ID
   * @returns {Promise<Object>} { ok: true, holdings: [], openPositionsCount: number }
   */
  async getOpenHoldings({ portfolioId }) {
    try {
      if (!portfolioId || typeof portfolioId !== "string") {
        return { ok: false, reason: "INVALID_PORTFOLIO_ID", holdings: [], openPositionsCount: 0 };
      }

      const { data, error } = await this.client
        .from("holdings")
        .select("ticker, shares, avg_cost")
        .eq("portfolio_id", portfolioId)
        .gt("shares", 0);

      if (error) {
        // Handle empty result gracefully
        if (error.code === "PGRST116") {
          return { ok: true, holdings: [], openPositionsCount: 0 };
        }
        return { ok: false, reason: "DB_ERROR", holdings: [], openPositionsCount: 0 };
      }

      const holdings = (data || [])
        .map((row) => ({
          ticker: row.ticker,
          shares: parseFloat(row.shares),
          avg_cost: parseFloat(row.avg_cost),
        }))
        .filter((h) => Number.isFinite(h.shares) && h.shares > 0);

      return {
        ok: true,
        holdings,
        openPositionsCount: holdings.length,
      };
    } catch (error) {
      return { ok: false, reason: "DB_ERROR", holdings: [], openPositionsCount: 0 };
    }
  }

  /**
   * Get today's net cashflow for a portfolio
   * @param {Object} params - Parameters
   * @param {string} params.portfolioId - Portfolio ID
   * @param {Date} params.now - Current timestamp
   * @returns {Promise<Object>} { ok: true, netCashflow, buyCount, sellCount, totalBuyValue, totalSellValue }
   */
  async getTodayNetCashflow({ portfolioId, now }) {
    try {
      if (!portfolioId || typeof portfolioId !== "string") {
        return {
          ok: false,
          reason: "INVALID_PORTFOLIO_ID",
          netCashflow: 0,
          buyCount: 0,
          sellCount: 0,
          totalBuyValue: 0,
          totalSellValue: 0,
        };
      }

      if (!(now instanceof Date)) {
        return {
          ok: false,
          reason: "INVALID_NOW",
          netCashflow: 0,
          buyCount: 0,
          sellCount: 0,
          totalBuyValue: 0,
          totalSellValue: 0,
        };
      }

      const todayStart = startOfDayUTC(now);
      const todayEnd = now;

      // Query trades executed today
      const { data, error } = await this.client
        .from("orders")
        .select("action, total_value")
        .eq("portfolio_id", portfolioId)
        .gte("executed_at", todayStart.toISOString())
        .lte("executed_at", todayEnd.toISOString())
        .eq("is_pending", false)
        .not("executed_at", "is", null);

      if (error) {
        // Handle empty result gracefully
        if (error.code === "PGRST116") {
          return {
            ok: true,
            netCashflow: 0,
            buyCount: 0,
            sellCount: 0,
            totalBuyValue: 0,
            totalSellValue: 0,
          };
        }
        // Log the actual error for debugging
        console.error(`[PortfolioStateRepo] getTodayNetCashflow error:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          portfolioId,
          todayStart: todayStart.toISOString(),
          todayEnd: todayEnd.toISOString(),
        });
        return {
          ok: false,
          reason: `DB_ERROR: ${error.message || error.code || 'Unknown error'}`,
          netCashflow: 0,
          buyCount: 0,
          sellCount: 0,
          totalBuyValue: 0,
          totalSellValue: 0,
        };
      }

      const trades = data || [];

      // Calculate totals
      let totalBuyValue = 0;
      let totalSellValue = 0;
      let buyCount = 0;
      let sellCount = 0;

      for (const trade of trades) {
        const value = parseFloat(trade.total_value);
        if (!Number.isFinite(value)) continue;

        if (trade.action === "buy") {
          totalBuyValue += value;
          buyCount++;
        } else if (trade.action === "sell") {
          totalSellValue += value;
          sellCount++;
        }
      }

      // Net cashflow = sells - buys (positive means money came in, negative means money went out)
      const netCashflow = totalSellValue - totalBuyValue;

      return {
        ok: true,
        netCashflow,
        buyCount,
        sellCount,
        totalBuyValue,
        totalSellValue,
      };
    } catch (error) {
      // Log the actual error for debugging
      console.error(`[PortfolioStateRepo] getTodayNetCashflow exception:`, {
        message: error.message,
        stack: error.stack,
        portfolioId,
      });
      return {
        ok: false,
        reason: `DB_ERROR: ${error.message || 'Unknown exception'}`,
        netCashflow: 0,
        buyCount: 0,
        sellCount: 0,
        totalBuyValue: 0,
        totalSellValue: 0,
      };
    }
  }

  /**
   * Get last stop-out timestamp for a portfolio
   * Looks for trades with stop-related reasoning or meta
   * @param {Object} params - Parameters
   * @param {string} params.portfolioId - Portfolio ID
   * @returns {Promise<Date|null>} Last stop-out timestamp or null
   */
  async getLastStopOutAt({ portfolioId }) {
    try {
      if (!portfolioId || typeof portfolioId !== "string") {
        return null;
      }

      // Query last 30 trades ordered by executed_at desc
      const { data, error } = await this.client
        .from("orders")
        .select("executed_at, reasoning, meta")
        .eq("portfolio_id", portfolioId)
        .not("executed_at", "is", null)
        .order("executed_at", { ascending: false })
        .limit(30);

      if (error) {
        // Handle empty result gracefully
        if (error.code === "PGRST116") {
          return null;
        }
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Find first trade with stop-related reasoning or meta
      for (const trade of data) {
        const reasoning = trade.reasoning || "";

        // Check if reasoning contains "stop" (case-insensitive)
        if (reasoning && reasoning.toLowerCase().includes("stop")) {
          return new Date(trade.executed_at);
        }

        // Parse meta safely (can be object or string)
        let meta = trade.meta;
        if (typeof meta === "string") {
          try {
            meta = JSON.parse(meta);
          } catch {
            meta = {};
          }
        }
        meta = meta && typeof meta === "object" ? meta : {};

        // Check if meta has exit_reason = 'stop'
        if (meta.exit_reason === "stop") {
          return new Date(trade.executed_at);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = { PortfolioStateRepository };

