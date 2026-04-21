import { matchesRule, applyRulesToTransactions } from '../../lib/category-rules';

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
});
