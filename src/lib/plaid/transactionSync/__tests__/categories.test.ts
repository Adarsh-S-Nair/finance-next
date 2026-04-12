import {
  buildCategoryLinkMaps,
  computeBackfillPlan,
  computeMissingCategoryGroupNames,
  extractPrimaryCategoryNames,
  getDefaultIconForGroup,
  linkRowsToCategories,
  resolveCategoryId,
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
