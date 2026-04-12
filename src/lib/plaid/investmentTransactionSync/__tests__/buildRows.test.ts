import {
  buildInvestmentTransactionRows,
  buildSecuritiesMap,
  mapTransactionToRow,
} from '../buildRows';
import type {
  AccountMap,
  PlaidInvestmentTransaction,
  PlaidSecurity,
  SecuritiesMap,
} from '../types';

describe('buildSecuritiesMap', () => {
  it('indexes securities by security_id', () => {
    const securities: PlaidSecurity[] = [
      { security_id: 'sec1', ticker_symbol: 'AAPL', name: 'Apple Inc', type: 'equity' },
      { security_id: 'sec2', ticker_symbol: 'MSFT', name: 'Microsoft Corp', type: 'equity' },
    ];

    const map = buildSecuritiesMap(securities);

    expect(map.size).toBe(2);
    expect(map.get('sec1')).toEqual({
      ticker: 'AAPL',
      name: 'Apple Inc',
      type: 'equity',
      subtype: null,
    });
    expect(map.get('sec2')?.ticker).toBe('MSFT');
  });

  it('falls back to name when ticker_symbol is missing (legacy quirk)', () => {
    // Cash positions and some ETFs come back with no ticker. The legacy
    // route populated `ticker` from `name` in that case — we must preserve
    // the exact behavior so existing rows round-trip cleanly.
    const securities: PlaidSecurity[] = [
      { security_id: 'cashSec', ticker_symbol: null, name: 'US Dollar', type: 'cash' },
    ];

    const map = buildSecuritiesMap(securities);
    expect(map.get('cashSec')?.ticker).toBe('US Dollar');
  });

  it('sets ticker to null when both ticker_symbol and name are missing', () => {
    const securities: PlaidSecurity[] = [
      { security_id: 'weirdSec', ticker_symbol: null, name: null, type: null },
    ];

    const map = buildSecuritiesMap(securities);
    expect(map.get('weirdSec')?.ticker).toBeNull();
    expect(map.get('weirdSec')?.name).toBeNull();
  });

  it('returns an empty map for an empty input', () => {
    expect(buildSecuritiesMap([]).size).toBe(0);
  });
});

describe('mapTransactionToRow', () => {
  const accountMap: AccountMap = {
    'plaid_acct_1': 'db-uuid-1',
  };

  const securitiesMap: SecuritiesMap = new Map([
    [
      'sec1',
      { ticker: 'AAPL', name: 'Apple Inc', type: 'equity', subtype: 'common stock' },
    ],
  ]);

  it('maps a standard buy transaction to a row', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx1',
      account_id: 'plaid_acct_1',
      security_id: 'sec1',
      name: 'BUY AAPL',
      amount: 150.25,
      iso_currency_code: 'USD',
      transaction_datetime: '2024-01-15T14:30:00Z',
      date: '2024-01-15',
      quantity: 1,
      price: 150.25,
      fees: 0,
      type: 'buy',
      subtype: 'buy',
    };

    const row = mapTransactionToRow(tx, accountMap, securitiesMap);

    expect(row).not.toBeNull();
    expect(row!.account_id).toBe('db-uuid-1');
    expect(row!.plaid_transaction_id).toBe('tx1');
    expect(row!.description).toBe('BUY AAPL');
    expect(row!.amount).toBe(150.25);
    expect(row!.currency_code).toBe('USD');
    expect(row!.pending).toBe(false);
    expect(row!.datetime).toBe('2024-01-15T14:30:00.000Z');
    expect(row!.date).toBe('2024-01-15');
    expect(row!.transaction_source).toBe('investments');
    expect(row!.investment_details.ticker).toBe('AAPL');
    expect(row!.investment_details.security_name).toBe('Apple Inc');
    expect(row!.investment_details.quantity).toBe(1);
    expect(row!.investment_details.price).toBe(150.25);
    expect(row!.investment_details.type).toBe('buy');
  });

  it('returns null when the account is not in the map', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_orphan',
      account_id: 'unknown_acct',
      amount: 100,
    };
    expect(mapTransactionToRow(tx, accountMap, securitiesMap)).toBeNull();
  });

  it('falls back to "Investment Transaction" when name is missing', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_noname',
      account_id: 'plaid_acct_1',
      amount: 50,
    };
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    expect(row?.description).toBe('Investment Transaction');
  });

  it('defaults currency_code to USD when Plaid omits it', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_nocurrency',
      account_id: 'plaid_acct_1',
      amount: 50,
      iso_currency_code: null,
    };
    expect(mapTransactionToRow(tx, accountMap, securitiesMap)?.currency_code).toBe('USD');
  });

  it('sets datetime to null when transaction_datetime is missing', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_notime',
      account_id: 'plaid_acct_1',
      amount: 50,
      date: '2024-01-15',
    };
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    expect(row?.datetime).toBeNull();
    expect(row?.date).toBe('2024-01-15');
  });

  it('coerces string quantity/price/fees to numbers', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_strings',
      account_id: 'plaid_acct_1',
      amount: 100,
      // Plaid sometimes returns these as strings depending on SDK version.
      quantity: '2.5',
      price: '40.00',
      fees: '0.99',
    };
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    expect(row?.investment_details.quantity).toBe(2.5);
    expect(row?.investment_details.price).toBe(40);
    expect(row?.investment_details.fees).toBe(0.99);
  });

  it('maps null/undefined quantity/price/fees to null', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_nulls',
      account_id: 'plaid_acct_1',
      amount: 0,
      quantity: null,
      price: undefined,
      fees: null,
    };
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    expect(row?.investment_details.quantity).toBeNull();
    expect(row?.investment_details.price).toBeNull();
    expect(row?.investment_details.fees).toBeNull();
  });

  it('maps unknown security_id to null security fields', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_unknown_sec',
      account_id: 'plaid_acct_1',
      security_id: 'not_in_map',
      amount: 10,
    };
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    expect(row?.investment_details.security_id).toBe('not_in_map');
    expect(row?.investment_details.ticker).toBeNull();
    expect(row?.investment_details.security_name).toBeNull();
  });

  it('handles transactions with no security_id', () => {
    const tx: PlaidInvestmentTransaction = {
      investment_transaction_id: 'tx_cashfee',
      account_id: 'plaid_acct_1',
      amount: 5,
      name: 'Account Fee',
      type: 'fee',
    };
    const row = mapTransactionToRow(tx, accountMap, securitiesMap);
    expect(row?.investment_details.security_id).toBeNull();
    expect(row?.investment_details.ticker).toBeNull();
  });
});

describe('buildInvestmentTransactionRows', () => {
  const accountMap: AccountMap = { 'plaid_acct_1': 'db-uuid-1' };
  const securitiesMap: SecuritiesMap = new Map();

  it('builds rows for all transactions with valid accounts', () => {
    const txs: PlaidInvestmentTransaction[] = [
      { investment_transaction_id: 'tx1', account_id: 'plaid_acct_1', amount: 100 },
      { investment_transaction_id: 'tx2', account_id: 'plaid_acct_1', amount: 200 },
    ];
    const result = buildInvestmentTransactionRows(txs, accountMap, securitiesMap);
    expect(result.rows).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
  });

  it('counts transactions with orphaned accounts as skipped', () => {
    const txs: PlaidInvestmentTransaction[] = [
      { investment_transaction_id: 'tx1', account_id: 'plaid_acct_1', amount: 100 },
      { investment_transaction_id: 'tx2', account_id: 'orphan_acct', amount: 200 },
      { investment_transaction_id: 'tx3', account_id: 'another_orphan', amount: 300 },
    ];
    const result = buildInvestmentTransactionRows(txs, accountMap, securitiesMap);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedCount).toBe(2);
    expect(result.rows[0].plaid_transaction_id).toBe('tx1');
  });

  it('returns an empty result for an empty input', () => {
    const result = buildInvestmentTransactionRows([], accountMap, securitiesMap);
    expect(result.rows).toEqual([]);
    expect(result.skippedCount).toBe(0);
  });
});
