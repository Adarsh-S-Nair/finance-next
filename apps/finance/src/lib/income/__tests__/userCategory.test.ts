import { effectiveCategory } from '../userCategory';

const plaidSalary = {
  pfcPrimary: 'INCOME',
  pfcDetailed: 'INCOME_SALARY',
};

describe('effectiveCategory', () => {
  it('passes Plaid through untouched when the user has not categorised', () => {
    expect(
      effectiveCategory({
        ...plaidSalary,
        isUserCategorized: false,
        userLabel: 'Tax Refund',
        userGroup: 'Income',
      }),
    ).toEqual({ primary: 'INCOME', detailed: 'INCOME_SALARY' });
  });

  it('maps a user "Tax Refund" onto INCOME_TAX_REFUND (excluded by detector)', () => {
    expect(
      effectiveCategory({
        ...plaidSalary,
        isUserCategorized: true,
        userLabel: 'Tax Refund',
        userGroup: 'Income',
      }),
    ).toEqual({ primary: 'INCOME', detailed: 'INCOME_TAX_REFUND' });
  });

  it('maps user interest/dividends onto their detaileds', () => {
    expect(
      effectiveCategory({
        ...plaidSalary,
        isUserCategorized: true,
        userLabel: 'Interest Earned',
        userGroup: 'Income',
      }).detailed,
    ).toBe('INCOME_INTEREST_EARNED');
  });

  it('demotes income moved out to a transfer group', () => {
    expect(
      effectiveCategory({
        ...plaidSalary,
        isUserCategorized: true,
        userLabel: 'Account Transfer',
        userGroup: 'Transfer In',
      }).primary,
    ).toBe('TRANSFER_IN');
  });

  it('demotes income moved to a non-income spending group', () => {
    expect(
      effectiveCategory({
        ...plaidSalary,
        isUserCategorized: true,
        userLabel: 'Refund',
        userGroup: 'Food and Drink',
      }).primary,
    ).toBe('OTHER');
  });

  it('keeps a user-confirmed salary as salary', () => {
    expect(
      effectiveCategory({
        ...plaidSalary,
        isUserCategorized: true,
        userLabel: 'Salary',
        userGroup: 'Income',
      }),
    ).toEqual({ primary: 'INCOME', detailed: 'INCOME_SALARY' });
  });
});
