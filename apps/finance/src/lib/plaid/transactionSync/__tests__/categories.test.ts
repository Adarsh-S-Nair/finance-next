import {
  buildCategoryLinkMaps,
  computeBackfillPlan,
  computeMissingCategoryGroupNames,
  extractPrimaryCategoryNames,
  getDefaultIconForGroup,
  linkRowsToCategories,
  resolveCategoryId,
  resolveDirectionMismatches,
  stripPrimaryPrefix,
} from '../categories';
import type { TransactionUpsertRow } from '../types';

function makeRow(
  primary: string | null,
  detailed: string | null,
  overrides: Partial<TransactionUpsertRow> = {}
): TransactionUpsertRow {
  return {
    account_id: 'acc-1',
    plaid_transaction_id: `tx-${Math.random()}`,
    description: 'desc',
    amount: -10,
    currency_code: 'USD',
    pending: false,
    merchant_name: null,
    icon_url: null,
    personal_finance_category:
      primary && detailed ? { primary, detailed } : null,
    datetime: null,
    date: '2026-04-10',
    authorized_date: null,
    authorized_datetime: null,
    location: null,
    payment_channel: null,
    website: null,
    pending_plaid_transaction_id: null,
    category_id: null,
    ...overrides,
  };
}

describe('stripPrimaryPrefix', () => {
  it('removes the primary prefix from a detailed key', () => {
    expect(stripPrimaryPrefix('RENT_AND_UTILITIES_RENT', 'RENT_AND_UTILITIES')).toBe('RENT');
  });

  it('returns the detailed key unchanged when the prefix does not match', () => {
    expect(stripPrimaryPrefix('FOOD_GROCERIES', 'TRANSPORTATION')).toBe('FOOD_GROCERIES');
  });
});

describe('extractPrimaryCategoryNames', () => {
  it('returns formatted unique primary names', () => {
    const rows = [
      makeRow('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE'),
      makeRow('FOOD_AND_DRINK', 'FOOD_AND_DRINK_FAST_FOOD'),
      makeRow('TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
      makeRow(null, null),
    ];
    const names = extractPrimaryCategoryNames(rows);
    expect(names.size).toBe(2);
    expect(names.has('Food and Drink')).toBe(true);
    expect(names.has('Transportation')).toBe(true);
  });
});

describe('computeMissingCategoryGroupNames', () => {
  it('returns only names not present in the existing groups, case-insensitively', () => {
    const wanted = ['Food and Drink', 'Transportation', 'Travel'];
    const existing = [{ name: 'food and drink' }, { name: 'Travel' }];
    expect(computeMissingCategoryGroupNames(wanted, existing)).toEqual(['Transportation']);
  });

  it('returns an empty array when all wanted names already exist', () => {
    const wanted = ['Food and Drink'];
    const existing = [{ name: 'Food and Drink' }];
    expect(computeMissingCategoryGroupNames(wanted, existing)).toEqual([]);
  });
});

describe('getDefaultIconForGroup', () => {
  it('returns the mapped icon for a known group', () => {
    expect(getDefaultIconForGroup('Food and Drink')).toEqual({
      icon_lib: 'Fi',
      icon_name: 'FiCoffee',
    });
  });

  it('returns a sensible fallback icon for an unknown group', () => {
    expect(getDefaultIconForGroup('Crypto Gambling')).toEqual({
      icon_lib: 'Fi',
      icon_name: 'FiTag',
    });
  });
});

describe('category linking', () => {
  const systemCategories = [
    { id: 'cat-coffee', label: 'Coffee', plaid_category_key: 'FOOD_AND_DRINK_COFFEE' },
    { id: 'cat-taxis', label: 'Taxis and Ride Shares', plaid_category_key: null },
    { id: 'cat-rent', label: 'Rent', plaid_category_key: 'RENT_AND_UTILITIES_RENT' },
  ];

  it('buildCategoryLinkMaps builds both lookups', () => {
    const maps = buildCategoryLinkMaps(systemCategories);
    expect(maps.plaidKeyToId.get('FOOD_AND_DRINK_COFFEE')).toBe('cat-coffee');
    expect(maps.plaidKeyToId.has('TRANSPORTATION_TAXIS_AND_RIDE_SHARES')).toBe(false);
    expect(maps.labelToId.get('Taxis and Ride Shares')).toBe('cat-taxis');
  });

  it('resolveCategoryId prefers plaid_category_key', () => {
    const maps = buildCategoryLinkMaps(systemCategories);
    const id = resolveCategoryId(
      { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE' },
      maps
    );
    expect(id).toBe('cat-coffee');
  });

  it('resolveCategoryId falls back to formatted label when key is missing', () => {
    const maps = buildCategoryLinkMaps(systemCategories);
    const id = resolveCategoryId(
      {
        primary: 'TRANSPORTATION',
        detailed: 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES',
      },
      maps
    );
    expect(id).toBe('cat-taxis');
  });

  it('resolveCategoryId returns null when nothing matches', () => {
    const maps = buildCategoryLinkMaps(systemCategories);
    expect(
      resolveCategoryId({ primary: 'OTHER', detailed: 'OTHER_UNKNOWN' }, maps)
    ).toBeNull();
    expect(resolveCategoryId(null, maps)).toBeNull();
  });

  it('linkRowsToCategories sets category_id and returns linked count', () => {
    const rows = [
      makeRow('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE'),
      makeRow('TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
      makeRow('OTHER', 'OTHER_UNKNOWN'),
      makeRow(null, null),
    ];
    const linked = linkRowsToCategories(rows, systemCategories);
    expect(linked).toBe(2);
    expect(rows[0].category_id).toBe('cat-coffee');
    expect(rows[1].category_id).toBe('cat-taxis');
    expect(rows[2].category_id).toBeNull();
    expect(rows[3].category_id).toBeNull();
  });
});

describe('computeBackfillPlan', () => {
  // This test documents the *current* (legacy) behavior: the lookup uses the
  // raw Plaid primary against category_groups.name, which is stored in its
  // formatted form. As a result, the plan is empty unless the group name
  // happens to match the raw Plaid primary. See the NOTE in categories.ts.
  it('returns an empty plan when groups are stored by formatted name (documents legacy bug)', () => {
    const rows = [makeRow('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE')];
    const allGroups = [{ id: 'grp-food', name: 'Food and Drink' }];
    const categoriesMissingKey = [
      { id: 'cat-coffee', label: 'Coffee', group_id: 'grp-food' },
    ];

    const plan = computeBackfillPlan(rows, allGroups, categoriesMissingKey);
    expect(plan).toEqual([]);
  });

  it('returns a plan when a group happens to be stored with the raw primary name', () => {
    const rows = [makeRow('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE')];
    const allGroups = [{ id: 'grp-food', name: 'FOOD_AND_DRINK' }];
    const categoriesMissingKey = [
      { id: 'cat-coffee', label: 'Coffee', group_id: 'grp-food' },
    ];

    const plan = computeBackfillPlan(rows, allGroups, categoriesMissingKey);
    expect(plan).toEqual([
      { systemCategoryId: 'cat-coffee', plaid_category_key: 'FOOD_AND_DRINK_COFFEE' },
    ]);
  });
});

describe('resolveDirectionMismatches', () => {
  const cats = [
    { id: 'cat-food', label: 'Fast Food', direction: 'expense' as const },
    { id: 'cat-wages', label: 'Wages', direction: 'income' as const },
    { id: 'cat-refund', label: 'Refund', direction: 'income' as const },
    { id: 'cat-other', label: 'Other', direction: 'both' as const },
  ];

  it('re-routes a positive amount in an expense category to Refund', () => {
    const row = makeRow('FOOD_AND_DRINK', 'FOOD_AND_DRINK_FAST_FOOD', {
      amount: 12.5,
      category_id: 'cat-food',
    });
    const rerouted = resolveDirectionMismatches([row], cats);
    expect(rerouted).toBe(1);
    expect(row.category_id).toBe('cat-refund');
  });

  it('re-routes a negative amount in an income category to Other', () => {
    const row = makeRow('INCOME', 'INCOME_WAGES', {
      amount: -500,
      category_id: 'cat-wages',
    });
    const rerouted = resolveDirectionMismatches([row], cats);
    expect(rerouted).toBe(1);
    expect(row.category_id).toBe('cat-other');
  });

  it('leaves matching directions, both-direction, zero-amount, and uncategorized rows untouched', () => {
    const expense = makeRow(null, null, { amount: -20, category_id: 'cat-food' });
    const income = makeRow(null, null, { amount: 900, category_id: 'cat-wages' });
    const both = makeRow(null, null, { amount: 33, category_id: 'cat-other' });
    const zero = makeRow(null, null, { amount: 0, category_id: 'cat-food' });
    const uncategorized = makeRow(null, null, { amount: 10, category_id: null });
    const rows = [expense, income, both, zero, uncategorized];
    const rerouted = resolveDirectionMismatches(rows, cats);
    expect(rerouted).toBe(0);
    expect(rows.map((r) => r.category_id)).toEqual([
      'cat-food', 'cat-wages', 'cat-other', 'cat-food', null,
    ]);
  });

  it('falls back to Other for refunds when no Refund category exists', () => {
    const noRefund = cats.filter((c) => c.label !== 'Refund');
    const row = makeRow(null, null, { amount: 12.5, category_id: 'cat-food' });
    expect(resolveDirectionMismatches([row], noRefund)).toBe(1);
    expect(row.category_id).toBe('cat-other');
  });

  it('clears category_id when no safe target exists, so the upsert still succeeds', () => {
    const bare = cats.filter((c) => c.label !== 'Refund' && c.label !== 'Other');
    const refundish = makeRow(null, null, { amount: 12.5, category_id: 'cat-food' });
    const clawback = makeRow(null, null, { amount: -500, category_id: 'cat-wages' });
    expect(resolveDirectionMismatches([refundish, clawback], bare)).toBe(2);
    expect(refundish.category_id).toBeNull();
    expect(clawback.category_id).toBeNull();
  });

  it('ignores categories with unknown direction values and a Refund with the wrong direction', () => {
    const weird = [
      { id: 'cat-x', label: 'Mystery', direction: null },
      // Direction-mismatched "Refund" must not be used as the refund target
      { id: 'cat-fake-refund', label: 'Refund', direction: 'expense' as const },
      { id: 'cat-other', label: 'Other', direction: 'both' as const },
    ];
    const unknownDir = makeRow(null, null, { amount: 50, category_id: 'cat-x' });
    const refundish = makeRow(null, null, { amount: 50, category_id: 'cat-fake-refund' });
    // cat-x has no usable direction → untouched; cat-fake-refund is expense
    // direction with positive amount → re-routed, but to Other, not itself.
    expect(resolveDirectionMismatches([unknownDir, refundish], weird)).toBe(1);
    expect(unknownDir.category_id).toBe('cat-x');
    expect(refundish.category_id).toBe('cat-other');
  });
});
