import {
  type AllocatedGoal,
  type Goal,
  allocateCash,
  evaluatePace,
  nextGoalColor,
  relativeTargetDate,
  rowToGoal,
  GOAL_COLOR_PALETTE,
} from '../../components/goals/types';

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g1',
    name: 'Goal',
    kind: 'custom',
    target: 1000,
    priority: 1,
    status: 'active',
    isProtected: false,
    color: '#0891b2',
    lineItems: [],
    ...overrides,
  };
}

describe('allocateCash', () => {
  it('fills goals in priority order, each to its target before the next', () => {
    const { allocated, unallocated } = allocateCash(
      [
        goal({ id: 'b', priority: 2, target: 500 }),
        goal({ id: 'a', priority: 1, target: 1000 }),
      ],
      1200,
    );
    expect(allocated.map((g) => [g.id, g.allocated])).toEqual([
      ['a', 1000],
      ['b', 200],
    ]);
    expect(unallocated).toBe(0);
  });

  it('funds protected goals before unprotected ones regardless of priority', () => {
    const { allocated } = allocateCash(
      [
        goal({ id: 'vacation', priority: 1, target: 800 }),
        goal({ id: 'ef', priority: 9, target: 600, isProtected: true }),
      ],
      600,
    );
    expect(allocated[0].id).toBe('ef');
    expect(allocated[0].allocated).toBe(600);
    expect(allocated[1].allocated).toBe(0);
  });

  it('returns leftover cash once every goal is full', () => {
    const { unallocated } = allocateCash([goal({ target: 300 })], 1000);
    expect(unallocated).toBe(700);
  });

  it('treats a negative cash pool as zero', () => {
    const { allocated, unallocated } = allocateCash([goal({})], -50);
    expect(allocated[0].allocated).toBe(0);
    expect(unallocated).toBe(0);
  });

  it('excludes non-active goals from the waterfall', () => {
    const { allocated } = allocateCash(
      [
        goal({ id: 'done', status: 'complete', target: 400 }),
        goal({ id: 'live', target: 400 }),
      ],
      400,
    );
    expect(allocated.map((g) => g.id)).toEqual(['live']);
    expect(allocated[0].allocated).toBe(400);
  });

  it('clamps progress at a zero target instead of dividing by zero', () => {
    const { allocated } = allocateCash([goal({ target: 0 })], 100);
    expect(allocated[0].progress).toBe(0);
  });
});

describe('rowToGoal', () => {
  it('coerces numeric strings and maps line items', () => {
    const g = rowToGoal({
      id: 'r1',
      user_id: 'u1',
      name: 'House',
      kind: 'custom',
      target_amount: '2500.50',
      target_date: null,
      priority: 3,
      status: 'active',
      is_protected: false,
      color: '#fff',
      icon: null,
      ef_multiplier: null,
      excluded_essential_category_ids: null,
      line_items: [
        { id: 'li1', goal_id: 'r1', name: 'Down payment', target_amount: '2000' },
      ],
    });
    expect(g.target).toBe(2500.5);
    expect(g.targetDate).toBeUndefined();
    expect(g.lineItems).toEqual([{ id: 'li1', name: 'Down payment', target: 2000 }]);
    expect(g.excludedEssentialCategoryIds).toEqual([]);
  });
});

describe('evaluatePace', () => {
  const today = new Date(2026, 5, 12);
  function allocated(overrides: Partial<AllocatedGoal>): AllocatedGoal {
    return { ...goal({}), allocated: 500, progress: 0.5, targetDate: '2026-09-12', ...overrides };
  }

  it('classifies terminal and degenerate states first', () => {
    expect(evaluatePace(allocated({ status: 'complete' }), today)).toBe('complete');
    expect(evaluatePace(allocated({ allocated: 0 }), today)).toBe('unfunded');
    expect(evaluatePace(allocated({ targetDate: undefined }), today)).toBe('no_date');
  });

  it('past-due goals are on pace only when fully funded', () => {
    expect(evaluatePace(allocated({ targetDate: '2026-01-01', progress: 1 }), today)).toBe('on_pace');
    expect(evaluatePace(allocated({ targetDate: '2026-01-01', progress: 0.9 }), today)).toBe('behind');
  });

  it('compares progress against elapsed time within the assumed window', () => {
    // ~3 months left of the assumed 6-month window → elapsed ≈ 0.5
    expect(evaluatePace(allocated({ progress: 0.5 }), today)).toBe('on_pace');
    expect(evaluatePace(allocated({ progress: 0.7 }), today)).toBe('ahead');
    expect(evaluatePace(allocated({ progress: 0.3 }), today)).toBe('behind');
  });
});

describe('nextGoalColor', () => {
  it('picks the first palette color not already in use', () => {
    const used = [goal({ color: GOAL_COLOR_PALETTE[0] }), goal({ color: GOAL_COLOR_PALETTE[1] })];
    expect(nextGoalColor(used)).toBe(GOAL_COLOR_PALETTE[2]);
  });

  it('rotates through the palette when every color is taken', () => {
    const used = GOAL_COLOR_PALETTE.map((c, i) => goal({ id: `g${i}`, color: c }));
    expect(nextGoalColor(used)).toBe(GOAL_COLOR_PALETTE[used.length % GOAL_COLOR_PALETTE.length]);
  });
});

describe('relativeTargetDate', () => {
  const today = new Date(Date.UTC(2026, 5, 12));

  it('buckets by days, weeks, months, and years', () => {
    expect(relativeTargetDate('2026-06-12', today)).toBe('today');
    expect(relativeTargetDate('2026-06-20', today)).toBe('in 8 days');
    expect(relativeTargetDate('2026-07-12', today)).toBe('in 4 weeks');
    expect(relativeTargetDate('2026-10-12', today)).toBe('in 4 months');
    expect(relativeTargetDate('2028-06-12', today)).toBe('in 2.0 years');
  });

  it('describes past dates as days ago', () => {
    expect(relativeTargetDate('2026-06-02', today)).toBe('10 days ago');
  });
});
