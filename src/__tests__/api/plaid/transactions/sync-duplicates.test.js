/**
 * Regression test for duplicate system categories
 * Tests the utility function getNewSystemCategories directly
 */
import { getNewSystemCategories } from '../../../../lib/categoryUtils';

// Mock formatCategoryName since we are testing the utility that uses it
// But since we are importing the real file, we might get the real function.
// However, getNewSystemCategories calls formatCategoryName from the same module.
// In ES modules, internal calls are hard to mock without rewiring.
// But formatCategoryName is pure, so we can just let it run.

describe('Duplicate System Categories Regression Test', () => {
  it('should deduplicate system categories within the same batch', () => {
    // 1. Setup Mock Data
    const mockTransactions = [
      {
        transaction_id: 'tx_1',
        personal_finance_category: {
          primary: 'GENERAL_MERCHANDISE',
          detailed: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'
        }
      },
      {
        transaction_id: 'tx_2',
        personal_finance_category: {
          primary: 'GENERAL_MERCHANDISE',
          detailed: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'
        }
      }
    ];

    const existingSystemCategoryLabels = []; // No existing categories
    const categoryGroups = [
      { id: 'group_1', name: 'General Merchandise' }
    ];

    // 2. Execute
    const newCategories = getNewSystemCategories(
      mockTransactions,
      existingSystemCategoryLabels,
      categoryGroups
    );

    // 3. Assert
    // With the bug, this would be length 2.
    // With the fix, this should be length 1.
    expect(newCategories).toHaveLength(1);
    expect(newCategories[0].label).toBe('Clothing and Accessories');
    expect(newCategories[0].group_id).toBe('group_1');
  });

  it('should not create categories that already exist in existingSystemCategoryLabels', () => {
    const mockTransactions = [
      {
        transaction_id: 'tx_1',
        personal_finance_category: {
          primary: 'GENERAL_MERCHANDISE',
          detailed: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'
        }
      }
    ];

    const existingSystemCategoryLabels = ['Clothing and Accessories'];
    const categoryGroups = [
      { id: 'group_1', name: 'General Merchandise' }
    ];

    const newCategories = getNewSystemCategories(
      mockTransactions,
      existingSystemCategoryLabels,
      categoryGroups
    );

    expect(newCategories).toHaveLength(0);
  });
});
