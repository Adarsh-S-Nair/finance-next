import {
  matchesRule,
  applyRulesToTransactions,
  canonicalizeRuleOperator,
  conditionSubsumes,
  rulesEntail,
  ruleRelationship,
} from '../../lib/category-rules';

describe('Category Rules Logic', () => {
  describe('matchesRule', () => {
    const transaction = {
      merchant_name: 'Uber',
      description: 'Uber *Trip',
      amount: 25.50
    };

    it('should match exact merchant name', () => {
      const rule = {
        conditions: [{ field: 'merchant_name', operator: 'is', value: 'Uber' }]
      };
      expect(matchesRule(transaction, rule)).toBe(true);
    });

    it('should not match different merchant name', () => {
      const rule = {
        conditions: [{ field: 'merchant_name', operator: 'is', value: 'Lyft' }]
      };
      expect(matchesRule(transaction, rule)).toBe(false);
    });

    it('should match description contains', () => {
      const rule = {
        conditions: [{ field: 'description', operator: 'contains', value: 'Trip' }]
      };
      expect(matchesRule(transaction, rule)).toBe(true);
    });

    it('should match amount greater than', () => {
      const rule = {
        conditions: [{ field: 'amount', operator: 'is_greater_than', value: '20' }]
      };
      expect(matchesRule(transaction, rule)).toBe(true);
    });

    it('should match multiple conditions (AND logic)', () => {
      const rule = {
        conditions: [
          { field: 'merchant_name', operator: 'is', value: 'Uber' },
          { field: 'amount', operator: 'is_greater_than', value: '20' }
        ]
      };
      expect(matchesRule(transaction, rule)).toBe(true);
    });

    it('should fail if one condition fails', () => {
      const rule = {
        conditions: [
          { field: 'merchant_name', operator: 'is', value: 'Uber' },
          { field: 'amount', operator: 'is_greater_than', value: '100' }
        ]
      };
      expect(matchesRule(transaction, rule)).toBe(false);
    });

    // Expense amounts are stored as negative numbers in the DB, but
    // users (and the agent) write rules in positive magnitudes. The
    // matcher compares magnitudes so the same rule fires for the same
    // dollar amount regardless of direction.
    it('should match positive rule value against negative expense amount', () => {
      const expense = { merchant_name: 'Acme', description: 'Insurance', amount: -84.47 };
      const rule = {
        conditions: [{ field: 'amount', operator: 'is', value: 84.47 }]
      };
      expect(matchesRule(expense, rule)).toBe(true);
    });

    it('should match equals operator against negative expense amount', () => {
      const expense = { merchant_name: 'Acme', amount: -84.47 };
      const rule = {
        conditions: [{ field: 'amount', operator: 'equals', value: '84.47' }]
      };
      expect(matchesRule(expense, rule)).toBe(true);
    });

    it('should match is_greater_than against negative amount on magnitude', () => {
      const expense = { merchant_name: 'Acme', amount: -100 };
      const rule = {
        conditions: [{ field: 'amount', operator: 'is_greater_than', value: '50' }]
      };
      expect(matchesRule(expense, rule)).toBe(true);
    });

    it('should match is_less_than against negative amount on magnitude', () => {
      const expense = { merchant_name: 'Acme', amount: -25 };
      const rule = {
        conditions: [{ field: 'amount', operator: 'is_less_than', value: '50' }]
      };
      expect(matchesRule(expense, rule)).toBe(true);
    });

    it('should not match different magnitudes even if signs match', () => {
      const expense = { merchant_name: 'Acme', amount: -84.47 };
      const rule = {
        conditions: [{ field: 'amount', operator: 'is', value: 99.99 }]
      };
      expect(matchesRule(expense, rule)).toBe(false);
    });
  });

  describe('applyRulesToTransactions', () => {
    it('should apply rules to transactions', () => {
      const transactions = [
        { id: 1, merchant_name: 'Uber', category_id: 'old-cat' },
        { id: 2, merchant_name: 'Lyft', category_id: 'old-cat' }
      ];

      const rules = [
        {
          category_id: 'transport-cat',
          conditions: [{ field: 'merchant_name', operator: 'is', value: 'Uber' }]
        }
      ];

      const count = applyRulesToTransactions(transactions, rules);

      expect(count).toBe(1);
      expect(transactions[0].category_id).toBe('transport-cat');
      expect(transactions[1].category_id).toBe('old-cat');
    });

    it('should respect rule priority (first match wins)', () => {
      const transactions = [
        { id: 1, merchant_name: 'Uber', amount: 50 }
      ];

      const rules = [
        {
          category_id: 'high-priority',
          conditions: [{ field: 'merchant_name', operator: 'is', value: 'Uber' }]
        },
        {
          category_id: 'low-priority',
          conditions: [{ field: 'amount', operator: 'is_greater_than', value: '10' }]
        }
      ];

      applyRulesToTransactions(transactions, rules);

      expect(transactions[0].category_id).toBe('high-priority');
    });
  });

  // Behavioural aliases: `is`/`equals` are treated identically by
  // matchesRule, but the UI convention uses `equals` for amount and
  // `is` for string fields. Canonicalisation collapses the alias pair
  // onto the convention so two rules covering the same match space
  // don't render with different operator strings.
  describe('canonicalizeRuleOperator', () => {
    it('maps amount is → amount equals', () => {
      expect(canonicalizeRuleOperator('amount', 'is')).toBe('equals');
    });
    it('maps string equals → string is', () => {
      expect(canonicalizeRuleOperator('description', 'equals')).toBe('is');
      expect(canonicalizeRuleOperator('merchant_name', 'equals')).toBe('is');
    });
    it('passes other operators through unchanged', () => {
      expect(canonicalizeRuleOperator('description', 'contains')).toBe('contains');
      expect(canonicalizeRuleOperator('description', 'starts_with')).toBe('starts_with');
      expect(canonicalizeRuleOperator('amount', 'is_greater_than')).toBe('is_greater_than');
      expect(canonicalizeRuleOperator('amount', 'is_less_than')).toBe('is_less_than');
    });
  });

  describe('conditionSubsumes', () => {
    // Same field + same value: operator order is is < starts_with < contains.
    // a subsumes b iff a's match space is narrower-or-equal to b's match space.
    it('detects is X ⊆ contains X for string fields with same value', () => {
      const a = { field: 'description', operator: 'is', value: 'Instant transfer' };
      const b = { field: 'description', operator: 'contains', value: 'Instant transfer' };
      expect(conditionSubsumes(a, b)).toBe(true);
      expect(conditionSubsumes(b, a)).toBe(false);
    });
    it('detects is X ⊆ starts_with X for string fields', () => {
      const a = { field: 'description', operator: 'is', value: 'Spotify' };
      const b = { field: 'description', operator: 'starts_with', value: 'Spotify' };
      expect(conditionSubsumes(a, b)).toBe(true);
      expect(conditionSubsumes(b, a)).toBe(false);
    });
    it('detects starts_with X ⊆ contains X for string fields', () => {
      const a = { field: 'description', operator: 'starts_with', value: 'foo' };
      const b = { field: 'description', operator: 'contains', value: 'foo' };
      expect(conditionSubsumes(a, b)).toBe(true);
      expect(conditionSubsumes(b, a)).toBe(false);
    });
    it('treats is/equals as canonical aliases per field type', () => {
      // string field: equals canonicalises to is
      const sa = { field: 'description', operator: 'is', value: 'X' };
      const sb = { field: 'description', operator: 'equals', value: 'X' };
      expect(conditionSubsumes(sa, sb)).toBe(true);
      expect(conditionSubsumes(sb, sa)).toBe(true);
      // amount field: is canonicalises to equals
      const aa = { field: 'amount', operator: 'is', value: 84.47 };
      const ab = { field: 'amount', operator: 'equals', value: 84.47 };
      expect(conditionSubsumes(aa, ab)).toBe(true);
      expect(conditionSubsumes(ab, aa)).toBe(true);
    });
    it('handles case/whitespace differences in string values', () => {
      const a = { field: 'description', operator: 'is', value: '  Instant Transfer  ' };
      const b = { field: 'description', operator: 'contains', value: 'instant transfer' };
      expect(conditionSubsumes(a, b)).toBe(true);
    });
    it('compares amount values by magnitude', () => {
      const a = { field: 'amount', operator: 'equals', value: -84.47 };
      const b = { field: 'amount', operator: 'equals', value: 84.47 };
      expect(conditionSubsumes(a, b)).toBe(true);
    });
    it('returns false for incomparable amount operators (equals vs gt)', () => {
      const a = { field: 'amount', operator: 'equals', value: 50 };
      const b = { field: 'amount', operator: 'is_greater_than', value: 50 };
      expect(conditionSubsumes(a, b)).toBe(false);
      expect(conditionSubsumes(b, a)).toBe(false);
    });
    it('returns false when fields differ', () => {
      const a = { field: 'description', operator: 'is', value: 'X' };
      const b = { field: 'merchant_name', operator: 'is', value: 'X' };
      expect(conditionSubsumes(a, b)).toBe(false);
    });
    it('returns false when values differ (even when substring-related)', () => {
      // Deliberately conservative — substring relations on values are
      // not currently mapped (predictability over cleverness).
      const a = { field: 'description', operator: 'is', value: 'Instant transfer' };
      const b = { field: 'description', operator: 'contains', value: 'Instant' };
      expect(conditionSubsumes(a, b)).toBe(false);
    });
  });

  describe('ruleRelationship', () => {
    // The user-reported screenshot case: two rules for the same
    // amount, differing only in the description operator (is vs
    // contains). The previous opaque-key implementation missed this
    // and let both rules sit in the DB.
    it('catches the operator-mismatch duplicate from the screenshot', () => {
      const oldConds = [
        { field: 'description', operator: 'is', value: 'Instant transfer' },
        { field: 'amount', operator: 'equals', value: 84.47 },
      ];
      const newConds = [
        { field: 'description', operator: 'contains', value: 'Instant transfer' },
        { field: 'amount', operator: 'equals', value: 84.47 },
      ];
      // New is broader than old (is X ⊊ contains X).
      expect(ruleRelationship(newConds, oldConds)).toBe('new_broadens');
      // And the reverse perspective: old is narrower than new.
      expect(ruleRelationship(oldConds, newConds)).toBe('new_narrows');
    });
    it('detects identical for same field+value+canonicalised operator', () => {
      const a = [
        { field: 'description', operator: 'contains', value: 'Spotify' },
        { field: 'amount', operator: 'is', value: 9.99 },
      ];
      const b = [
        { field: 'description', operator: 'contains', value: 'Spotify' },
        { field: 'amount', operator: 'equals', value: 9.99 },
      ];
      expect(ruleRelationship(a, b)).toBe('identical');
    });
    it('detects new_narrows when new has extra conditions', () => {
      const existing = [
        { field: 'description', operator: 'contains', value: 'instant transfer' },
      ];
      const proposed = [
        { field: 'description', operator: 'contains', value: 'instant transfer' },
        { field: 'amount', operator: 'equals', value: 84.47 },
      ];
      expect(ruleRelationship(proposed, existing)).toBe('new_narrows');
    });
    it('returns null for disjoint rules', () => {
      const a = [{ field: 'merchant_name', operator: 'is', value: 'Spotify' }];
      const b = [{ field: 'merchant_name', operator: 'is', value: 'Netflix' }];
      expect(ruleRelationship(a, b)).toBeNull();
    });
    it('returns null for partial overlap (mixed-axis differences)', () => {
      // amount differs on one axis, description matches on another —
      // structurally incomparable, neither entails the other.
      const a = [
        { field: 'description', operator: 'contains', value: 'X' },
        { field: 'amount', operator: 'equals', value: 10 },
      ];
      const b = [
        { field: 'description', operator: 'contains', value: 'X' },
        { field: 'amount', operator: 'equals', value: 20 },
      ];
      expect(ruleRelationship(a, b)).toBeNull();
    });
  });

  describe('rulesEntail', () => {
    it('a entails b when a is more specific on every axis', () => {
      const a = [
        { field: 'description', operator: 'is', value: 'X' },
        { field: 'amount', operator: 'equals', value: 1 },
      ];
      const b = [
        { field: 'description', operator: 'contains', value: 'X' },
      ];
      expect(rulesEntail(a, b)).toBe(true);
    });
    it('a does not entail b when b requires something a is silent on', () => {
      const a = [{ field: 'description', operator: 'contains', value: 'X' }];
      const b = [
        { field: 'description', operator: 'contains', value: 'X' },
        { field: 'amount', operator: 'equals', value: 1 },
      ];
      expect(rulesEntail(a, b)).toBe(false);
    });
  });
});
