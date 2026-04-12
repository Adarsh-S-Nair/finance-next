/**
 * Types for the Plaid holdings sync pipeline.
 *
 * Narrow by design: we declare only the fields we read or write. The `plaid`
 * package's generated types are not used — they're broad and pull in unused
 * surface area. If Plaid ships a new field we care about, add it here.
 */

// ---------- Plaid shapes we consume ----------

export interface PlaidSecurity {
  security_id: string;
  ticker_symbol?: string | null;
  name?: string | null;
  type?: string | null; // 'equity' | 'etf' | 'cryptocurrency' | 'cash' | 'mutual fund' | ...
  is_cash_equivalent?: boolean | null;
}

export interface PlaidHolding {
  account_id: string;
  security_id: string;
  quantity?: number | string | null;
  vested_quantity?: number | string | null;
  unvested_quantity?: number | string | null;
  institution_value?: number | string | null;
  vested_value?: number | string | null;
  cost_basis?: number | string | null;
}

export interface PlaidInvestmentAccount {
  account_id: string;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
}

/**
 * Our internal view of a Plaid security, with classification already resolved.
 * Built once per sync by `buildSecurityMap`.
 */
export interface SecurityInfo {
  ticker: string;
  type: string | null;
  isCrypto: boolean;
  isCash: boolean;
  name: string | null;
  assetType: AssetType;
}

export type AssetType = 'stock' | 'crypto' | 'cash';

// ---------- DB account row we read ----------

export interface DbAccountRow {
  id: string;
  user_id: string;
  account_id: string; // Plaid account id
  name: string | null;
  type: string | null; // 'investment' | 'depository' | ...
  subtype: string | null;
  balances: Record<string, unknown> | null;
}

// ---------- Per-holding resolved values ----------

/**
 * Reason codes for how `resolveHoldingQuantity` decided on the quantity.
 * Exposed for test assertions and for debug output.
 */
export type QuantityReason =
  | 'explicit_vested_quantity'
  | 'derived_from_total_minus_unvested'
  | 'equity_comp_no_vesting_fields_assume_unvested'
  | 'no_vesting_fields_non_comp_account_use_full_quantity'
  | 'fallback_full_quantity';

export interface ResolvedQuantity {
  quantity: number;
  rawQuantity: number;
  rawVestedQuantity: number | null;
  rawUnvestedQuantity: number | null;
  reason: QuantityReason;
}

export interface ResolvedValue {
  institutionValue: number;
  totalInstitutionValue: number;
  costBasis: number;
  /** true when we pro-rated using vested/total ratio */
  proRated: boolean;
}

// ---------- Aggregated holdings + ticker inserts ----------

export interface AggregatedHolding {
  account_id: string; // DB uuid
  ticker: string;
  shares: number;
  avg_cost: number;
  asset_type: AssetType;
}

export interface TickerUpsertRow {
  symbol: string;
  name: string | null;
  sector: string | null;
  logo: string | null;
  asset_type: AssetType;
}

export interface ExistingTickerRow {
  symbol: string;
  name: string | null;
  sector: string | null;
  logo: string | null;
  asset_type: string | null;
}

// ---------- Result shape ----------

export interface HoldingsSyncResult {
  success: true;
  holdings_synced: number;
  plaid_accounts_count?: number;
  plaid_holdings_count?: number;
  holdings_debug?: HoldingDebugEntry[];
}

/**
 * Optional per-account debug payload returned when the caller passes
 * `includeDebug: true`. Matches the legacy shape.
 */
export interface HoldingDebugEntry {
  account_id: string;
  account_name: string | null;
  account_subtype: string | null;
  likely_equity_comp_account: boolean;
  holdings: Array<{
    ticker: string;
    security_id: string;
    quantity: number;
    vested_quantity: number | null;
    unvested_quantity: number | null;
    institution_value: number;
    vested_value: number | null;
    synced_quantity: number;
    synced_value: number;
    quantity_reason: QuantityReason;
  }>;
  non_zero_holdings_inserted?: number;
}

// ---------- Error shape ----------

/**
 * Thrown from the orchestrator to signal an HTTP-mappable failure. The
 * route layer reads `httpStatus` to choose the response code.
 */
export class HoldingsSyncError extends Error {
  httpStatus: number;
  code?: string;
  feature?: string;
  constructor(message: string, httpStatus: number, extra?: { code?: string; feature?: string }) {
    super(message);
    this.name = 'HoldingsSyncError';
    this.httpStatus = httpStatus;
    if (extra?.code) this.code = extra.code;
    if (extra?.feature) this.feature = extra.feature;
  }
}
