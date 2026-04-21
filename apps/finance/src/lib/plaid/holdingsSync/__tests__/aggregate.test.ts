import {
  aggregateHoldingsByTicker,
  buildCashTickerInserts,
  buildCryptoTickerInserts,
  buildStockTickerInserts,
  planTickerProcessing,
  resolveHoldingAssetType,
  type FinnhubTickerDetail,
  type PreparedHolding,
} from '../aggregate';
import type {
  CoinGeckoTickerInfo,
} from '../aggregate';
import type { ExistingTickerRow, SecurityInfo } from '../types';

function stockSecurity(ticker: string, name: string | null = null): SecurityInfo {
  return {
    ticker: ticker.toUpperCase(),
    type: 'equity',
    isCrypto: false,
    isCash: false,
    name,
    assetType: 'stock',
  };
}

describe('resolveHoldingAssetType', () => {
  it('keeps a stock classification when nothing overrides it', () => {
    const { assetType, isCashHolding } = resolveHoldingAssetType('AAPL', stockSecurity('AAPL'));
    expect(assetType).toBe('stock');
    expect(isCashHolding).toBe(false);
  });

  it('flips a stock-classified security to crypto when the ticker is known crypto', () => {
    const { assetType, securityInfo } = resolveHoldingAssetType('BTC', stockSecurity('BTC'));
    expect(assetType).toBe('crypto');
    expect(securityInfo.isCrypto).toBe(true);
  });

  it('treats legacy CUR:USD tickers as cash', () => {
    const { assetType, isCashHolding, securityInfo } = resolveHoldingAssetType(
      'CUR:USD',
      stockSecurity('CUR:USD')
    );
    expect(assetType).toBe('cash');
    expect(isCashHolding).toBe(true);
    expect(securityInfo.isCash).toBe(true);
  });
});

describe('aggregateHoldingsByTicker', () => {
  const DB_ACCOUNT = 'db-acc-1';

  it('rolls up a single holding into one row', () => {
    const prepared: PreparedHolding[] = [
      { ticker: 'AAPL', quantity: 10, costBasis: 1500, institutionValue: 1800, assetType: 'stock' },
    ];
    const rows = aggregateHoldingsByTicker(prepared, DB_ACCOUNT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      account_id: DB_ACCOUNT,
      ticker: 'AAPL',
      shares: 10,
      avg_cost: 150, // 1500 / 10
      asset_type: 'stock',
    });
  });

  it('sums shares and uses the legacy weighted-cost formula for duplicates', () => {
    // Legacy formula: new_avg = (existing.avg_cost * existing.shares + newCostBasis) / totalShares
    //   first:  10 shares, costBasis 1500 → avg_cost = 150
    //   second: 5 shares,  costBasis 1000 → totalShares = 15
    //                                       totalCostBasis = (150 * 10) + 1000 = 2500
    //                                       avg_cost = 2500 / 15 ≈ 166.666...
    const prepared: PreparedHolding[] = [
      { ticker: 'AAPL', quantity: 10, costBasis: 1500, institutionValue: 1800, assetType: 'stock' },
      { ticker: 'AAPL', quantity: 5, costBasis: 1000, institutionValue: 900, assetType: 'stock' },
    ];
    const rows = aggregateHoldingsByTicker(prepared, DB_ACCOUNT);
    expect(rows).toHaveLength(1);
    expect(rows[0].shares).toBe(15);
    expect(rows[0].avg_cost).toBeCloseTo(166.666, 2);
  });

  it('handles zero-quantity holdings without NaN', () => {
    const prepared: PreparedHolding[] = [
      { ticker: 'ZERO', quantity: 0, costBasis: 100, institutionValue: 0, assetType: 'stock' },
    ];
    const rows = aggregateHoldingsByTicker(prepared, DB_ACCOUNT);
    expect(rows[0].avg_cost).toBe(0);
  });

  it('keeps multiple tickers separate', () => {
    const prepared: PreparedHolding[] = [
      { ticker: 'AAPL', quantity: 10, costBasis: 1500, institutionValue: 1800, assetType: 'stock' },
      { ticker: 'TSLA', quantity: 2, costBasis: 500, institutionValue: 700, assetType: 'stock' },
    ];
    const rows = aggregateHoldingsByTicker(prepared, DB_ACCOUNT);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.ticker).sort()).toEqual(['AAPL', 'TSLA']);
  });
});

describe('planTickerProcessing', () => {
  it('marks tickers not in the DB as new', () => {
    const plan = planTickerProcessing(
      ['AAPL', 'TSLA'],
      [],
      new Set(),
      new Set()
    );
    expect(plan.stockTickers).toEqual(['AAPL', 'TSLA']);
    expect(plan.cryptoTickers).toEqual([]);
    expect(plan.cashTickers).toEqual([]);
  });

  it('leaves fully-populated existing tickers alone', () => {
    const existing: ExistingTickerRow[] = [
      { symbol: 'AAPL', name: 'Apple', sector: 'Tech', logo: 'https://...', asset_type: 'stock' },
    ];
    const plan = planTickerProcessing(['AAPL'], existing, new Set(), new Set());
    expect(plan.stockTickers).toEqual([]);
  });

  it('re-processes rows missing name/sector/logo', () => {
    const existing: ExistingTickerRow[] = [
      { symbol: 'AAPL', name: null, sector: 'Tech', logo: 'x', asset_type: 'stock' },
      { symbol: 'TSLA', name: 'Tesla', sector: '', logo: 'x', asset_type: 'stock' },
      { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech', logo: '', asset_type: 'stock' },
    ];
    const plan = planTickerProcessing(
      ['AAPL', 'TSLA', 'MSFT'],
      existing,
      new Set(),
      new Set()
    );
    expect(plan.stockTickers.sort()).toEqual(['AAPL', 'MSFT', 'TSLA']);
  });

  it('re-processes rows with the wrong asset_type', () => {
    // BTC is in the DB as a stock, but cryptoTickerSet says it should be crypto
    const existing: ExistingTickerRow[] = [
      { symbol: 'BTC', name: 'Bitcoin', sector: 'Cryptocurrency', logo: 'x', asset_type: 'stock' },
    ];
    const plan = planTickerProcessing(
      ['BTC'],
      existing,
      new Set(['BTC']),
      new Set()
    );
    expect(plan.cryptoTickers).toEqual(['BTC']);
  });

  it('splits tickers into stock/crypto/cash buckets', () => {
    const plan = planTickerProcessing(
      ['AAPL', 'BTC', 'USD'],
      [],
      new Set(['BTC']),
      new Set(['USD'])
    );
    expect(plan.stockTickers).toEqual(['AAPL']);
    expect(plan.cryptoTickers).toEqual(['BTC']);
    expect(plan.cashTickers).toEqual(['USD']);
  });
});

describe('buildStockTickerInserts', () => {
  it('builds rows from Finnhub details, preferring existing non-empty fields', () => {
    const existing: ExistingTickerRow[] = [
      { symbol: 'AAPL', name: 'Apple Existing', sector: null, logo: null, asset_type: 'stock' },
    ];
    const existingMap = new Map(existing.map((r) => [r.symbol, r]));
    const details: FinnhubTickerDetail[] = [
      { ticker: 'AAPL', name: 'Apple Inc. (Finnhub)', sector: 'Technology', domain: 'apple.com' },
    ];
    const rows = buildStockTickerInserts(['AAPL'], existingMap, details, 'logo-key');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Apple Existing'); // existing non-empty wins
    expect(rows[0].sector).toBe('Technology'); // existing null → Finnhub
    expect(rows[0].logo).toBe('https://img.logo.dev/apple.com?token=logo-key');
    expect(rows[0].asset_type).toBe('stock');
  });

  it('returns null logo when no domain and no existing logo', () => {
    const rows = buildStockTickerInserts(
      ['TSLA'],
      new Map(),
      [{ ticker: 'TSLA', name: 'Tesla', sector: 'Auto', domain: null }],
      'logo-key'
    );
    expect(rows[0].logo).toBeNull();
  });

  it('ignores Finnhub details for tickers not in the wanted set', () => {
    const rows = buildStockTickerInserts(
      ['AAPL'],
      new Map(),
      [
        { ticker: 'AAPL', name: 'Apple', sector: null, domain: null },
        { ticker: 'TSLA', name: 'Tesla', sector: null, domain: null },
      ],
      null
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe('AAPL');
  });
});

describe('buildCryptoTickerInserts', () => {
  it('prefers existing non-empty name/sector/logo, then CoinGecko, then Plaid security', () => {
    const existingMap = new Map<string, ExistingTickerRow>([
      ['BTC', { symbol: 'BTC', name: null, sector: null, logo: null, asset_type: 'crypto' }],
    ]);
    const gecko = new Map<string, CoinGeckoTickerInfo>([
      ['BTC', { logo: 'https://cdn/btc.png', name: 'Bitcoin' }],
    ]);
    const secInfo = new Map<string, SecurityInfo>();
    const rows = buildCryptoTickerInserts(['BTC'], existingMap, gecko, secInfo);
    expect(rows[0].name).toBe('Bitcoin');
    expect(rows[0].sector).toBe('Cryptocurrency');
    expect(rows[0].logo).toBe('https://cdn/btc.png');
    expect(rows[0].asset_type).toBe('crypto');
  });

  it('falls back to the ticker symbol when no name is available', () => {
    const rows = buildCryptoTickerInserts(
      ['NEWCOIN'],
      new Map(),
      new Map(),
      new Map()
    );
    expect(rows[0].name).toBe('NEWCOIN');
    expect(rows[0].logo).toBeNull();
  });
});

describe('buildCashTickerInserts', () => {
  it('builds cash rows with sector=Cash and no logo by default', () => {
    const rows = buildCashTickerInserts(['USD'], new Map(), new Map());
    expect(rows[0].sector).toBe('Cash');
    expect(rows[0].logo).toBeNull();
    expect(rows[0].asset_type).toBe('cash');
    expect(rows[0].name).toBe('USD');
  });

  it('preserves existing non-empty fields', () => {
    const existingMap = new Map<string, ExistingTickerRow>([
      ['USD', { symbol: 'USD', name: 'US Dollar', sector: 'Fiat', logo: 'x', asset_type: 'cash' }],
    ]);
    const rows = buildCashTickerInserts(['USD'], existingMap, new Map());
    expect(rows[0].name).toBe('US Dollar');
    expect(rows[0].sector).toBe('Fiat');
    expect(rows[0].logo).toBe('x');
  });
});
