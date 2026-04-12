import {
  buildTransactionRows,
  mapTransactionToRow,
  resolveEffectiveDate,
} from '../buildRows';
import type { AccountMap, PlaidTransaction } from '../types';

const ACCOUNT_MAP: AccountMap = {
  plaid_acc_1: 'db-uuid-1',
  plaid_acc_2: 'db-uuid-2',
};

function makeTx(overrides: Partial<PlaidTransaction> = {}): PlaidTransaction {
  return {
    transaction_id: 'tx-1',
    account_id: 'plaid_acc_1',
    name: 'Starbucks',
    amount: 5.75,
    iso_currency_code: 'USD',
    pending: false,
    date: '2026-04-10',
    ...overrides,
  };
}

describe('resolveEffectiveDate', () => {
  it('prefers authorized_datetime and converts to EST calendar day', () => {
    // 2026-04-11 01:30 UTC = 2026-04-10 21:30 EDT, so effective = 2026-04-10
    const tx = makeTx({ authorized_datetime: '2026-04-11T01:30:00Z' });
    expect(resolveEffectiveDate(tx)).toBe('2026-04-10');
  });

  it('falls back to datetime when authorized_datetime is missing', () => {
    const tx = makeTx({
      authorized_datetime: undefined,
      datetime: '2026-04-11T01:30:00Z',
    });
    expect(resolveEffectiveDate(tx)).toBe('2026-04-10');
  });

  it('falls back to authorized_date when no datetimes are set', () => {
    const tx = makeTx({
      authorized_datetime: undefined,
      datetime: undefined,
      authorized_date: '2026-03-15',
      date: '2026-03-16',
    });
    expect(resolveEffectiveDate(tx)).toBe('2026-03-15');
  });

  it('falls back to plain date as last resort', () => {
    const tx = makeTx({
      authorized_datetime: undefined,
      datetime: undefined,
      authorized_date: undefined,
      date: '2026-03-16',
    });
    expect(resolveEffectiveDate(tx)).toBe('2026-03-16');
  });
});

describe('mapTransactionToRow', () => {
  it('maps a basic transaction and inverts the sign of amount', () => {
    const tx = makeTx({ amount: 12.34 });
    const row = mapTransactionToRow(tx, ACCOUNT_MAP);
    expect(row).not.toBeNull();
    expect(row!.amount).toBe(-12.34);
    expect(row!.account_id).toBe('db-uuid-1');
    expect(row!.plaid_transaction_id).toBe('tx-1');
    expect(row!.description).toBe('Starbucks');
    expect(row!.category_id).toBeNull();
  });

  it('returns null for transactions whose account is not in the map', () => {
    const tx = makeTx({ account_id: 'unknown_acc' });
    expect(mapTransactionToRow(tx, ACCOUNT_MAP)).toBeNull();
  });

  it('falls back to original_description and then "Unknown" for description', () => {
    const noName = mapTransactionToRow(
      makeTx({ name: null, original_description: 'Raw desc' }),
      ACCOUNT_MAP
    );
    expect(noName!.description).toBe('Raw desc');

    const noAnything = mapTransactionToRow(
      makeTx({ name: null, original_description: null }),
      ACCOUNT_MAP
    );
    expect(noAnything!.description).toBe('Unknown');
  });

  it('uses counterparty logo when tx logo is missing', () => {
    const row = mapTransactionToRow(
      makeTx({
        logo_url: null,
        counterparties: [{ logo_url: 'https://cdn/img.png' }],
      }),
      ACCOUNT_MAP
    );
    expect(row!.icon_url).toBe('https://cdn/img.png');
  });

  it('defaults currency to USD when not provided', () => {
    const row = mapTransactionToRow(makeTx({ iso_currency_code: null }), ACCOUNT_MAP);
    expect(row!.currency_code).toBe('USD');
  });
});

describe('buildTransactionRows', () => {
  it('maps multiple transactions and tracks pending replacements', () => {
    const txs: PlaidTransaction[] = [
      makeTx({ transaction_id: 'a' }),
      makeTx({
        transaction_id: 'b',
        pending_transaction_id: 'pending-old-1',
      }),
      makeTx({ transaction_id: 'c', account_id: 'unknown_acc' }),
    ];

    const result = buildTransactionRows(txs, ACCOUNT_MAP);

    expect(result.rows).toHaveLength(2);
    expect(result.skippedCount).toBe(1);
    expect(result.pendingReplacements).toEqual([
      { pending_plaid_transaction_id: 'pending-old-1', account_uuid: 'db-uuid-1' },
    ]);
  });

  it('handles an empty batch', () => {
    const result = buildTransactionRows([], ACCOUNT_MAP);
    expect(result.rows).toEqual([]);
    expect(result.pendingReplacements).toEqual([]);
    expect(result.skippedCount).toBe(0);
  });
});
