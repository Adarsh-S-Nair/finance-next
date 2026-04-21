import { buildStreamRecord, buildStreamRecords } from '../buildRecord';
import type { PlaidRecurringStream } from '../types';

const NOW_ISO = '2024-01-15T12:00:00.000Z';

function makeStream(overrides: Partial<PlaidRecurringStream> = {}): PlaidRecurringStream {
  return {
    account_id: 'plaid_acct_1',
    stream_id: 'stream_abc',
    description: 'NETFLIX',
    merchant_name: 'Netflix',
    frequency: 'MONTHLY',
    status: 'MATURE',
    is_active: true,
    first_date: '2023-01-15',
    last_date: '2024-01-15',
    predicted_next_date: '2024-02-15',
    average_amount: { amount: -14.99, iso_currency_code: 'USD' },
    last_amount: { amount: -14.99, iso_currency_code: 'USD' },
    personal_finance_category: {
      primary: 'ENTERTAINMENT',
      detailed: 'ENTERTAINMENT_TV_AND_MOVIES',
    },
    transaction_ids: ['tx1', 'tx2', 'tx3'],
    ...overrides,
  };
}

describe('buildStreamRecord', () => {
  it('maps a standard outflow stream to a record', () => {
    const record = buildStreamRecord({
      stream: makeStream(),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });

    expect(record.user_id).toBe('user-1');
    expect(record.plaid_item_id).toBe('item-1');
    expect(record.account_id).toBe('plaid_acct_1');
    expect(record.stream_id).toBe('stream_abc');
    expect(record.stream_type).toBe('outflow');
    expect(record.description).toBe('NETFLIX');
    expect(record.merchant_name).toBe('Netflix');
    expect(record.frequency).toBe('MONTHLY');
    expect(record.status).toBe('MATURE');
    expect(record.is_active).toBe(true);
    expect(record.first_date).toBe('2023-01-15');
    expect(record.last_date).toBe('2024-01-15');
    expect(record.predicted_next_date).toBe('2024-02-15');
    expect(record.category_primary).toBe('ENTERTAINMENT');
    expect(record.category_detailed).toBe('ENTERTAINMENT_TV_AND_MOVIES');
    expect(record.transaction_ids).toEqual(['tx1', 'tx2', 'tx3']);
    expect(record.updated_at).toBe(NOW_ISO);
    expect(record.synced_at).toBe(NOW_ISO);
  });

  it('absolute-values the average and last amounts (outflow)', () => {
    // Plaid reports outflows as negative. We store magnitudes.
    const record = buildStreamRecord({
      stream: makeStream({
        average_amount: { amount: -14.99, iso_currency_code: 'USD' },
        last_amount: { amount: -14.99, iso_currency_code: 'USD' },
      }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.average_amount).toBe(14.99);
    expect(record.last_amount).toBe(14.99);
  });

  it('absolute-values the amounts for inflow too (no sign flip)', () => {
    // Inflows are already positive; Math.abs is a no-op.
    const record = buildStreamRecord({
      stream: makeStream({
        average_amount: { amount: 2500, iso_currency_code: 'USD' },
        last_amount: { amount: 2500, iso_currency_code: 'USD' },
      }),
      streamType: 'inflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.average_amount).toBe(2500);
    expect(record.last_amount).toBe(2500);
  });

  it('defaults amounts to 0 when Plaid omits them', () => {
    const record = buildStreamRecord({
      stream: makeStream({ average_amount: null, last_amount: null }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.average_amount).toBe(0);
    expect(record.last_amount).toBe(0);
  });

  it('defaults iso_currency_code to USD when absent', () => {
    const record = buildStreamRecord({
      stream: makeStream({
        average_amount: { amount: -10, iso_currency_code: null },
      }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.iso_currency_code).toBe('USD');
  });

  it('coerces empty-string and falsy merchant_name to null', () => {
    const empty = buildStreamRecord({
      stream: makeStream({ merchant_name: '' }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(empty.merchant_name).toBeNull();

    const nullish = buildStreamRecord({
      stream: makeStream({ merchant_name: null }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(nullish.merchant_name).toBeNull();
  });

  it('coerces falsy predicted_next_date to null', () => {
    const record = buildStreamRecord({
      stream: makeStream({ predicted_next_date: null }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.predicted_next_date).toBeNull();
  });

  it('defaults transaction_ids to empty array when absent', () => {
    const record = buildStreamRecord({
      stream: makeStream({ transaction_ids: null }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.transaction_ids).toEqual([]);
  });

  it('maps category fields from personal_finance_category', () => {
    const record = buildStreamRecord({
      stream: makeStream({
        personal_finance_category: {
          primary: 'FOOD_AND_DRINK',
          detailed: 'FOOD_AND_DRINK_COFFEE',
        },
      }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.category_primary).toBe('FOOD_AND_DRINK');
    expect(record.category_detailed).toBe('FOOD_AND_DRINK_COFFEE');
  });

  it('maps missing category to null fields', () => {
    const record = buildStreamRecord({
      stream: makeStream({ personal_finance_category: null }),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: NOW_ISO,
    });
    expect(record.category_primary).toBeNull();
    expect(record.category_detailed).toBeNull();
  });

  it('uses the injected nowIso for both updated_at and synced_at', () => {
    const record = buildStreamRecord({
      stream: makeStream(),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
      nowIso: '2099-12-31T23:59:59.999Z',
    });
    expect(record.updated_at).toBe('2099-12-31T23:59:59.999Z');
    expect(record.synced_at).toBe('2099-12-31T23:59:59.999Z');
  });

  it('uses Date.now() when nowIso is not injected', () => {
    const before = Date.now();
    const record = buildStreamRecord({
      stream: makeStream(),
      streamType: 'outflow',
      userId: 'user-1',
      plaidItemId: 'item-1',
    });
    const after = Date.now();
    const recordTime = new Date(record.updated_at).getTime();
    expect(recordTime).toBeGreaterThanOrEqual(before);
    expect(recordTime).toBeLessThanOrEqual(after);
  });
});

describe('buildStreamRecords', () => {
  it('tags inflow streams with stream_type=inflow', () => {
    const records = buildStreamRecords({
      inflowStreams: [makeStream({ stream_id: 'paycheck' })],
      outflowStreams: [],
      userId: 'u',
      plaidItemId: 'i',
      nowIso: NOW_ISO,
    });
    expect(records).toHaveLength(1);
    expect(records[0].stream_type).toBe('inflow');
    expect(records[0].stream_id).toBe('paycheck');
  });

  it('tags outflow streams with stream_type=outflow', () => {
    const records = buildStreamRecords({
      inflowStreams: [],
      outflowStreams: [makeStream({ stream_id: 'rent' })],
      userId: 'u',
      plaidItemId: 'i',
      nowIso: NOW_ISO,
    });
    expect(records).toHaveLength(1);
    expect(records[0].stream_type).toBe('outflow');
  });

  it('returns inflow records before outflow records', () => {
    const records = buildStreamRecords({
      inflowStreams: [makeStream({ stream_id: 'in1' }), makeStream({ stream_id: 'in2' })],
      outflowStreams: [makeStream({ stream_id: 'out1' })],
      userId: 'u',
      plaidItemId: 'i',
      nowIso: NOW_ISO,
    });
    expect(records.map((r) => r.stream_id)).toEqual(['in1', 'in2', 'out1']);
    expect(records.slice(0, 2).every((r) => r.stream_type === 'inflow')).toBe(true);
    expect(records[2].stream_type).toBe('outflow');
  });

  it('returns an empty array when both stream lists are empty', () => {
    const records = buildStreamRecords({
      inflowStreams: [],
      outflowStreams: [],
      userId: 'u',
      plaidItemId: 'i',
      nowIso: NOW_ISO,
    });
    expect(records).toEqual([]);
  });
});
