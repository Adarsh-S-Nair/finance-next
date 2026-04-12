/**
 * Unit tests for src/lib/spending.js
 *
 * spending.js takes the Supabase client as an injected argument, so we don't
 * need jest.mock — we build a fake client that returns pre-configured
 * responses for each table query and pass it in directly.
 *
 * Coverage goals (issue #97):
 *   - input validation (missing userId, invalid date)
 *   - empty-budget short-circuit
 *   - category-level budget matching
 *   - category-group-level budget matching (via the categoryGroupMap lookup)
 *   - amount coercion (string / null / missing)
 *   - percentage math edge cases (zero budget, overspend, negative spent)
 *   - propagation of Supabase errors
 *   - delete scoping (id AND user_id)
 *
 * Behavioral gaps that are pinned but NOT fixed here (see NOTE comments):
 *   - Transfers are not excluded; a budget on a transfer category would count transfers as "spent"
 *   - Split transactions are not decomposed; a transaction's full amount is attributed to its primary category_id
 *   - Refunds (negative amounts) reduce `spent` and can produce negative percentages
 *
 * Per the "preserve behavior when refactoring" rule in docs/architectural_patterns.md,
 * these gaps are documented here so any future cleanup has a regression baseline.
 */

import { getBudgetProgress, upsertBudget, deleteBudget } from '../../lib/spending';

/**
 * Build a fake Supabase client that returns pre-configured responses per table.
 *
 * Usage:
 *   const supabase = makeMockSupabase({
 *     budgets: { data: [...], error: null },
 *     transactions: { data: [...], error: null },
 *     system_categories: { data: [...], error: null },
 *   });
 *
 * Every query-builder method (.select, .eq, .gte, .lte, .upsert, .delete, etc.)
 * is recorded on the builder and returns the builder itself, so any chain shape
 * used in spending.js works. The builder is thenable — awaiting it (or its
 * .single() terminator) resolves to the response configured for the table.
 */
function makeMockSupabase(responses = {}) {
  const calls = {
    from: [],
    byTable: {},
  };

  const client = {
    from: jest.fn((table) => {
      calls.from.push(table);
      calls.byTable[table] = calls.byTable[table] || [];

      const response = responses[table] ?? { data: [], error: null };
      const record = (method, args) => {
        calls.byTable[table].push({ method, args });
      };

      const builder = {
        select: jest.fn((...args) => { record('select', args); return builder; }),
        eq: jest.fn((...args) => { record('eq', args); return builder; }),
        gte: jest.fn((...args) => { record('gte', args); return builder; }),
        lte: jest.fn((...args) => { record('lte', args); return builder; }),
        order: jest.fn((...args) => { record('order', args); return builder; }),
        limit: jest.fn((...args) => { record('limit', args); return builder; }),
        upsert: jest.fn((...args) => { record('upsert', args); return builder; }),
        delete: jest.fn((...args) => { record('delete', args); return builder; }),
        single: jest.fn(() => { record('single', []); return Promise.resolve(response); }),
        // Thenable: awaiting the builder (without .single()) yields the response
        then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
      };

      return builder;
    }),
    __calls: calls,
  };

  return client;
}

// Silence expected console.error output from caught supabase errors
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

// ---------------------------------------------------------------------------
// getBudgetProgress
// ---------------------------------------------------------------------------

describe('getBudgetProgress', () => {
  const USER_ID = 'user-abc';

  describe('input validation', () => {
    test('throws when userId is missing', async () => {
      const supabase = makeMockSupabase();
      await expect(getBudgetProgress(supabase, null)).rejects.toThrow('UserId is required');
      await expect(getBudgetProgress(supabase, undefined)).rejects.toThrow('UserId is required');
      await expect(getBudgetProgress(supabase, '')).rejects.toThrow('UserId is required');
    });

    test('throws when monthDate is invalid', async () => {
      const supabase = makeMockSupabase();
      await expect(
        getBudgetProgress(supabase, USER_ID, 'not-a-date')
      ).rejects.toThrow('Invalid date provided');
    });

    test('accepts a Date object for monthDate', async () => {
      const supabase = makeMockSupabase({ budgets: { data: [], error: null } });
      await expect(
        getBudgetProgress(supabase, USER_ID, new Date('2026-03-15'))
      ).resolves.toEqual([]);
    });

    test('accepts an ISO string for monthDate', async () => {
      const supabase = makeMockSupabase({ budgets: { data: [], error: null } });
      await expect(
        getBudgetProgress(supabase, USER_ID, '2026-03-15')
      ).resolves.toEqual([]);
    });
  });

  describe('empty budgets short-circuit', () => {
    test('returns empty array when user has no budgets', async () => {
      const supabase = makeMockSupabase({ budgets: { data: [], error: null } });
      const result = await getBudgetProgress(supabase, USER_ID);
      expect(result).toEqual([]);
      // Should NOT fetch transactions or categories — short-circuits early
      expect(supabase.__calls.from).toEqual(['budgets']);
    });

    test('returns empty array when budgets is null', async () => {
      const supabase = makeMockSupabase({ budgets: { data: null, error: null } });
      const result = await getBudgetProgress(supabase, USER_ID);
      expect(result).toEqual([]);
    });
  });

  describe('category-level budget matching', () => {
    test('sums transactions whose category_id matches the budget', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', user_id: USER_ID, category_id: 'cat-food', category_group_id: null, amount: 200 }],
          error: null,
        },
        transactions: {
          data: [
            { amount: 30, category_id: 'cat-food' },
            { amount: 25, category_id: 'cat-food' },
            { amount: 100, category_id: 'cat-rent' }, // ignored — different category
          ],
          error: null,
        },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(55);
      expect(result.remaining).toBe(145);
      expect(result.percentage).toBeCloseTo(27.5);
    });

    test('returns zero spent when no transactions match', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 200 }],
          error: null,
        },
        transactions: { data: [{ amount: 99, category_id: 'cat-other' }], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(0);
      expect(result.remaining).toBe(200);
      expect(result.percentage).toBe(0);
    });
  });

  describe('category-group-level budget matching', () => {
    test('uses categoryGroupMap to match transactions by their category group', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: null, category_group_id: 'grp-food', amount: 500 }],
          error: null,
        },
        transactions: {
          data: [
            { amount: 40, category_id: 'cat-restaurants' }, // → grp-food
            { amount: 15, category_id: 'cat-groceries' },   // → grp-food
            { amount: 80, category_id: 'cat-rent' },         // → grp-housing, ignored
          ],
          error: null,
        },
        system_categories: {
          data: [
            { id: 'cat-restaurants', group_id: 'grp-food' },
            { id: 'cat-groceries',   group_id: 'grp-food' },
            { id: 'cat-rent',        group_id: 'grp-housing' },
          ],
          error: null,
        },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(55);
      expect(result.remaining).toBe(445);
      expect(result.percentage).toBeCloseTo(11);
    });

    test('ignores transactions whose category is not in the categoryGroupMap', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: null, category_group_id: 'grp-food', amount: 100 }],
          error: null,
        },
        transactions: {
          data: [
            { amount: 50, category_id: 'cat-unknown' }, // not in map → undefined group → ignored
            { amount: 30, category_id: 'cat-restaurants' },
          ],
          error: null,
        },
        system_categories: {
          data: [{ id: 'cat-restaurants', group_id: 'grp-food' }],
          error: null,
        },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(30);
    });

    test('returns zero spent when budget has neither category_id nor category_group_id', async () => {
      // Defensive: the DB should enforce one-of, but the function's filter returns
      // false for this case, so spent should be 0.
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: null, category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: [{ amount: 50, category_id: 'cat-food' }], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(0);
    });
  });

  describe('amount coercion', () => {
    test('coerces string amounts to numbers', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: {
          data: [
            { amount: '12.50', category_id: 'cat-food' },
            { amount: '7.25',  category_id: 'cat-food' },
          ],
          error: null,
        },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(19.75);
    });

    test('treats null amounts as zero', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: {
          data: [
            { amount: null, category_id: 'cat-food' },
            { amount: 10,   category_id: 'cat-food' },
          ],
          error: null,
        },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(10);
    });

    test('treats undefined amounts as zero', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: {
          data: [{ category_id: 'cat-food' }, { amount: 5, category_id: 'cat-food' }],
          error: null,
        },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(5);
    });

    test('treats non-numeric strings as zero', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: {
          data: [{ amount: 'abc', category_id: 'cat-food' }, { amount: 20, category_id: 'cat-food' }],
          error: null,
        },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      // Number('abc') is NaN; `NaN || 0` is 0, so the non-numeric amount contributes 0
      expect(result.spent).toBe(20);
    });
  });

  describe('percentage math', () => {
    test('computes percentage correctly for normal usage', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: [{ amount: 73, category_id: 'cat-food' }], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.percentage).toBe(73);
    });

    test('percentage is uncapped above 100 on overspend', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: [{ amount: 250, category_id: 'cat-food' }], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.percentage).toBe(250);
      expect(result.remaining).toBe(-150);
    });

    test('percentage is 100 when budget amount is zero and spent is positive', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 0 }],
          error: null,
        },
        transactions: { data: [{ amount: 10, category_id: 'cat-food' }], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.percentage).toBe(100);
      expect(result.remaining).toBe(-10);
    });

    test('percentage is 0 when budget amount is zero and spent is zero', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 0 }],
          error: null,
        },
        transactions: { data: [], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.percentage).toBe(0);
      expect(result.remaining).toBe(0);
    });

    test('refunds (negative amounts) reduce spent and produce a negative percentage', async () => {
      // NOTE: This pins current behavior. A $50 refund on a $100 budget produces
      // spent=-50, remaining=150, percentage=-50. Whether that's the right UX for
      // the budget bar is a separate question — see the header comment for the
      // behavioral-gap list.
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: [{ amount: -50, category_id: 'cat-food' }], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result.spent).toBe(-50);
      expect(result.remaining).toBe(150);
      expect(result.percentage).toBe(-50);
    });
  });

  describe('error propagation', () => {
    test('throws when the budgets query errors', async () => {
      const supabase = makeMockSupabase({
        budgets: { data: null, error: new Error('budgets query failed') },
      });
      await expect(getBudgetProgress(supabase, USER_ID)).rejects.toThrow('budgets query failed');
    });

    test('throws when the transactions query errors', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: null, error: new Error('transactions query failed') },
        system_categories: { data: [], error: null },
      });
      await expect(getBudgetProgress(supabase, USER_ID)).rejects.toThrow('transactions query failed');
    });

    test('throws when the system_categories query errors', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: [], error: null },
        system_categories: { data: null, error: new Error('categories query failed') },
      });
      await expect(getBudgetProgress(supabase, USER_ID)).rejects.toThrow('categories query failed');
    });
  });

  describe('query shape', () => {
    test('scopes the budgets query by user_id', async () => {
      const supabase = makeMockSupabase({ budgets: { data: [], error: null } });
      await getBudgetProgress(supabase, USER_ID);

      const eqCalls = supabase.__calls.byTable.budgets.filter(c => c.method === 'eq');
      expect(eqCalls).toContainEqual({ method: 'eq', args: ['user_id', USER_ID] });
    });

    test('queries transactions with a datetime range matching the requested month', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [{ id: 'b1', category_id: 'cat-food', category_group_id: null, amount: 100 }],
          error: null,
        },
        transactions: { data: [], error: null },
        system_categories: { data: [], error: null },
      });

      await getBudgetProgress(supabase, USER_ID, new Date('2026-03-15T12:00:00Z'));

      const txCalls = supabase.__calls.byTable.transactions;
      const gte = txCalls.find(c => c.method === 'gte');
      const lte = txCalls.find(c => c.method === 'lte');

      expect(gte).toBeDefined();
      expect(lte).toBeDefined();
      expect(gte.args[0]).toBe('datetime');
      expect(lte.args[0]).toBe('datetime');
      // start-of-month and end-of-month are produced by date-fns in the host
      // timezone, then serialized to ISO. We don't assert the exact timezone-
      // dependent value — just that the range brackets the 15th.
      expect(new Date(gte.args[1]).getTime()).toBeLessThan(new Date('2026-03-15T12:00:00Z').getTime());
      expect(new Date(lte.args[1]).getTime()).toBeGreaterThan(new Date('2026-03-15T12:00:00Z').getTime());
    });

    test('preserves the full budget object in the result', async () => {
      const budget = {
        id: 'b1',
        user_id: USER_ID,
        category_id: 'cat-food',
        category_group_id: null,
        amount: 100,
        category_groups: { id: 'grp-food', name: 'Food', icon_name: 'FiCoffee', icon_lib: 'Fi' },
        system_categories: { id: 'cat-food', label: 'Restaurants', group_id: 'grp-food' },
      };
      const supabase = makeMockSupabase({
        budgets: { data: [budget], error: null },
        transactions: { data: [], error: null },
        system_categories: { data: [], error: null },
      });

      const [result] = await getBudgetProgress(supabase, USER_ID);
      expect(result).toMatchObject(budget);
      expect(result).toHaveProperty('spent');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('percentage');
    });

    test('handles multiple budgets independently', async () => {
      const supabase = makeMockSupabase({
        budgets: {
          data: [
            { id: 'b-food',    category_id: 'cat-food',    category_group_id: null, amount: 200 },
            { id: 'b-gas',     category_id: 'cat-gas',     category_group_id: null, amount: 150 },
            { id: 'b-unused',  category_id: 'cat-unused',  category_group_id: null, amount: 50 },
          ],
          error: null,
        },
        transactions: {
          data: [
            { amount: 60, category_id: 'cat-food' },
            { amount: 40, category_id: 'cat-food' },
            { amount: 30, category_id: 'cat-gas' },
          ],
          error: null,
        },
        system_categories: { data: [], error: null },
      });

      const [food, gas, unused] = await getBudgetProgress(supabase, USER_ID);
      expect(food.spent).toBe(100);
      expect(gas.spent).toBe(30);
      expect(unused.spent).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// upsertBudget
// ---------------------------------------------------------------------------

describe('upsertBudget', () => {
  test('throws when user_id is missing from budgetData', async () => {
    const supabase = makeMockSupabase();
    await expect(upsertBudget(supabase, { amount: 100 })).rejects.toThrow(
      'user_id is required in budgetData'
    );
    // Should not even hit supabase
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('returns the upserted row', async () => {
    const upserted = { id: 'b1', user_id: 'u1', category_id: 'cat-food', amount: 100 };
    const supabase = makeMockSupabase({
      budgets: { data: upserted, error: null },
    });

    const result = await upsertBudget(supabase, { user_id: 'u1', category_id: 'cat-food', amount: 100 });
    expect(result).toEqual(upserted);

    // Verify it went through the upsert chain
    const calls = supabase.__calls.byTable.budgets.map(c => c.method);
    expect(calls).toContain('upsert');
    expect(calls).toContain('select');
    expect(calls).toContain('single');
  });

  test('throws when the supabase upsert fails', async () => {
    const supabase = makeMockSupabase({
      budgets: { data: null, error: new Error('upsert failed') },
    });
    await expect(
      upsertBudget(supabase, { user_id: 'u1', amount: 100 })
    ).rejects.toThrow('upsert failed');
  });
});

// ---------------------------------------------------------------------------
// deleteBudget
// ---------------------------------------------------------------------------

describe('deleteBudget', () => {
  test('throws when userId is missing', async () => {
    const supabase = makeMockSupabase();
    await expect(deleteBudget(supabase, 'b1', null)).rejects.toThrow(
      'userId is required for deletion safety'
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('scopes delete by both id AND user_id', async () => {
    const supabase = makeMockSupabase({ budgets: { data: null, error: null } });
    const result = await deleteBudget(supabase, 'b1', 'u1');
    expect(result).toBe(true);

    // Critical safety check: delete must be scoped by user_id, not just id.
    // Otherwise a client could delete another user's budget.
    const eqCalls = supabase.__calls.byTable.budgets
      .filter(c => c.method === 'eq')
      .map(c => c.args);
    expect(eqCalls).toContainEqual(['id', 'b1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
  });

  test('throws when the supabase delete fails', async () => {
    const supabase = makeMockSupabase({
      budgets: { data: null, error: new Error('delete failed') },
    });
    await expect(deleteBudget(supabase, 'b1', 'u1')).rejects.toThrow('delete failed');
  });
});
