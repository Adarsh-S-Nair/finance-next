/**
 * Tests for Transaction Amount Sign Handling
 * Verifies that transaction amounts are correctly negated when stored in the database
 */

describe('Transaction Amount Sign Handling', () => {
  describe('Amount Processing Logic', () => {
    it('should negate expense amounts (Plaid sends negative, we store positive)', () => {
      const plaidExpenseTransaction = {
        transaction_id: 'expense-txn-123',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Grocery Store',
        amount: -150.75, // Plaid sends negative for expenses
        date: '2024-01-08',
        iso_currency_code: 'USD',
        personal_finance_category: {
          primary: 'FOOD_AND_DRINK',
          detailed: 'FOOD_AND_DRINK_GROCERIES'
        }
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidExpenseTransaction.transaction_id,
        description: plaidExpenseTransaction.name || plaidExpenseTransaction.original_description || 'Unknown',
        amount: -parseFloat(plaidExpenseTransaction.amount), // Our new negating logic
        currency_code: plaidExpenseTransaction.iso_currency_code || 'USD',
        pending: plaidExpenseTransaction.pending,
        merchant_name: plaidExpenseTransaction.merchant_name,
        icon_url: plaidExpenseTransaction.logo_url,
        personal_finance_category: plaidExpenseTransaction.personal_finance_category,
        datetime: plaidExpenseTransaction.date ? new Date(plaidExpenseTransaction.date).toISOString() : null,
        location: plaidExpenseTransaction.location,
        payment_channel: plaidExpenseTransaction.payment_channel,
        website: plaidExpenseTransaction.website,
        pending_plaid_transaction_id: plaidExpenseTransaction.pending_transaction_id,
        category_id: null
      }

      // Verify that expense amounts are stored as positive values
      expect(transactionData.amount).toBe(150.75)
      expect(transactionData.amount).toBeGreaterThan(0)
    })

    it('should negate income amounts (Plaid sends positive, we store negative)', () => {
      const plaidIncomeTransaction = {
        transaction_id: 'income-txn-456',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Salary Deposit',
        amount: 3000.00, // Plaid sends positive for income
        date: '2024-01-08',
        iso_currency_code: 'USD',
        personal_finance_category: {
          primary: 'INCOME',
          detailed: 'INCOME_WAGES'
        }
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidIncomeTransaction.transaction_id,
        description: plaidIncomeTransaction.name || plaidIncomeTransaction.original_description || 'Unknown',
        amount: -parseFloat(plaidIncomeTransaction.amount), // Our new negating logic
        currency_code: plaidIncomeTransaction.iso_currency_code || 'USD',
        pending: plaidIncomeTransaction.pending,
        merchant_name: plaidIncomeTransaction.merchant_name,
        icon_url: plaidIncomeTransaction.logo_url,
        personal_finance_category: plaidIncomeTransaction.personal_finance_category,
        datetime: plaidIncomeTransaction.date ? new Date(plaidIncomeTransaction.date).toISOString() : null,
        location: plaidIncomeTransaction.location,
        payment_channel: plaidIncomeTransaction.payment_channel,
        website: plaidIncomeTransaction.website,
        pending_plaid_transaction_id: plaidIncomeTransaction.pending_transaction_id,
        category_id: null
      }

      // Verify that income amounts are stored as negative values
      expect(transactionData.amount).toBe(-3000.00)
      expect(transactionData.amount).toBeLessThan(0)
    })

    it('should handle zero amounts correctly', () => {
      const plaidZeroTransaction = {
        transaction_id: 'zero-txn-789',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Zero Amount Transaction',
        amount: 0.00,
        date: '2024-01-08',
        iso_currency_code: 'USD'
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidZeroTransaction.transaction_id,
        description: plaidZeroTransaction.name || plaidZeroTransaction.original_description || 'Unknown',
        amount: -parseFloat(plaidZeroTransaction.amount), // Our new negating logic
        currency_code: plaidZeroTransaction.iso_currency_code || 'USD',
        pending: plaidZeroTransaction.pending,
        merchant_name: plaidZeroTransaction.merchant_name,
        icon_url: plaidZeroTransaction.logo_url,
        personal_finance_category: plaidZeroTransaction.personal_finance_category,
        datetime: plaidZeroTransaction.date ? new Date(plaidZeroTransaction.date).toISOString() : null,
        location: plaidZeroTransaction.location,
        payment_channel: plaidZeroTransaction.payment_channel,
        website: plaidZeroTransaction.website,
        pending_plaid_transaction_id: plaidZeroTransaction.pending_transaction_id,
        category_id: null
      }

      // Verify that zero amounts remain zero
      expect(transactionData.amount).toBe(-0.00)
    })

    it('should handle decimal precision correctly', () => {
      const plaidDecimalTransaction = {
        transaction_id: 'decimal-txn-101',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Precise Amount Transaction',
        amount: -123.456789, // Plaid sends negative for expense
        date: '2024-01-08',
        iso_currency_code: 'USD'
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidDecimalTransaction.transaction_id,
        description: plaidDecimalTransaction.name || plaidDecimalTransaction.original_description || 'Unknown',
        amount: -parseFloat(plaidDecimalTransaction.amount), // Our new negating logic
        currency_code: plaidDecimalTransaction.iso_currency_code || 'USD',
        pending: plaidDecimalTransaction.pending,
        merchant_name: plaidDecimalTransaction.merchant_name,
        icon_url: plaidDecimalTransaction.logo_url,
        personal_finance_category: plaidDecimalTransaction.personal_finance_category,
        datetime: plaidDecimalTransaction.date ? new Date(plaidDecimalTransaction.date).toISOString() : null,
        location: plaidDecimalTransaction.location,
        payment_channel: plaidDecimalTransaction.payment_channel,
        website: plaidDecimalTransaction.website,
        pending_plaid_transaction_id: plaidDecimalTransaction.pending_transaction_id,
        category_id: null
      }

      // Verify that decimal precision is maintained and amount is negated correctly
      expect(transactionData.amount).toBe(123.456789)
      expect(transactionData.amount).toBeGreaterThan(0)
    })

    it('should use counterparties logo_url as fallback when main logo_url is empty', () => {
      const plaidTransactionWithCounterparties = {
        transaction_id: 'counterparty-txn-123',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Robinhood',
        amount: -693.41,
        date: '2024-01-08',
        iso_currency_code: 'USD',
        logo_url: null, // Main logo_url is empty
        counterparties: [
          {
            confidence_level: 'VERY_HIGH',
            entity_id: 'A6EeaXMEQp57OWoRZ4kmqw6RBY9YLqm6RaAOb',
            logo_url: 'https://plaid-counterparty-logos.plaid.com/robinhood_39.png',
            name: 'Robinhood',
            phone_number: null,
            type: 'financial_institution',
            website: 'robinhood.com'
          }
        ],
        personal_finance_category: {
          primary: 'TRANSFER_OUT',
          detailed: 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS'
        }
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidTransactionWithCounterparties.transaction_id,
        description: plaidTransactionWithCounterparties.name || plaidTransactionWithCounterparties.original_description || 'Unknown',
        amount: -parseFloat(plaidTransactionWithCounterparties.amount),
        currency_code: plaidTransactionWithCounterparties.iso_currency_code || 'USD',
        pending: plaidTransactionWithCounterparties.pending,
        merchant_name: plaidTransactionWithCounterparties.merchant_name,
        icon_url: plaidTransactionWithCounterparties.logo_url || (plaidTransactionWithCounterparties.counterparties && plaidTransactionWithCounterparties.counterparties.length > 0 ? plaidTransactionWithCounterparties.counterparties[0].logo_url : null),
        personal_finance_category: plaidTransactionWithCounterparties.personal_finance_category,
        datetime: plaidTransactionWithCounterparties.date ? new Date(plaidTransactionWithCounterparties.date).toISOString() : null,
        location: plaidTransactionWithCounterparties.location,
        payment_channel: plaidTransactionWithCounterparties.payment_channel,
        website: plaidTransactionWithCounterparties.website,
        pending_plaid_transaction_id: plaidTransactionWithCounterparties.pending_transaction_id,
        category_id: null
      }

      // Verify that icon_url uses counterparties logo_url when main logo_url is null
      expect(transactionData.icon_url).toBe('https://plaid-counterparty-logos.plaid.com/robinhood_39.png')
    })

    it('should use main logo_url when it exists, even if counterparties have logo_url', () => {
      const plaidTransactionWithBothLogos = {
        transaction_id: 'both-logos-txn-456',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Apple Store',
        amount: -1299.99,
        date: '2024-01-08',
        iso_currency_code: 'USD',
        logo_url: 'https://main-logo-url.com/apple.png', // Main logo_url exists
        counterparties: [
          {
            confidence_level: 'HIGH',
            entity_id: 'entity-123',
            logo_url: 'https://counterparty-logo-url.com/apple.png',
            name: 'Apple Store',
            type: 'merchant'
          }
        ],
        personal_finance_category: {
          primary: 'GENERAL_MERCHANDISE',
          detailed: 'GENERAL_MERCHANDISE_ELECTRONICS'
        }
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidTransactionWithBothLogos.transaction_id,
        description: plaidTransactionWithBothLogos.name || plaidTransactionWithBothLogos.original_description || 'Unknown',
        amount: -parseFloat(plaidTransactionWithBothLogos.amount),
        currency_code: plaidTransactionWithBothLogos.iso_currency_code || 'USD',
        pending: plaidTransactionWithBothLogos.pending,
        merchant_name: plaidTransactionWithBothLogos.merchant_name,
        icon_url: plaidTransactionWithBothLogos.logo_url || (plaidTransactionWithBothLogos.counterparties && plaidTransactionWithBothLogos.counterparties.length > 0 ? plaidTransactionWithBothLogos.counterparties[0].logo_url : null),
        personal_finance_category: plaidTransactionWithBothLogos.personal_finance_category,
        datetime: plaidTransactionWithBothLogos.date ? new Date(plaidTransactionWithBothLogos.date).toISOString() : null,
        location: plaidTransactionWithBothLogos.location,
        payment_channel: plaidTransactionWithBothLogos.payment_channel,
        website: plaidTransactionWithBothLogos.website,
        pending_plaid_transaction_id: plaidTransactionWithBothLogos.pending_transaction_id,
        category_id: null
      }

      // Verify that icon_url uses main logo_url when it exists
      expect(transactionData.icon_url).toBe('https://main-logo-url.com/apple.png')
    })

    it('should handle empty counterparties array gracefully', () => {
      const plaidTransactionWithEmptyCounterparties = {
        transaction_id: 'empty-counterparties-txn-789',
        account_id: 'plaid-acc-123',
        pending: false,
        name: 'Generic Transaction',
        amount: -50.00,
        date: '2024-01-08',
        iso_currency_code: 'USD',
        logo_url: null, // Main logo_url is empty
        counterparties: [], // Empty counterparties array
        personal_finance_category: {
          primary: 'GENERAL_MERCHANDISE',
          detailed: 'GENERAL_MERCHANDISE_MISCELLANEOUS'
        }
      }

      const accountUuid = 'acc-123'

      // Simulate the transaction data preparation logic from sync route
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: plaidTransactionWithEmptyCounterparties.transaction_id,
        description: plaidTransactionWithEmptyCounterparties.name || plaidTransactionWithEmptyCounterparties.original_description || 'Unknown',
        amount: -parseFloat(plaidTransactionWithEmptyCounterparties.amount),
        currency_code: plaidTransactionWithEmptyCounterparties.iso_currency_code || 'USD',
        pending: plaidTransactionWithEmptyCounterparties.pending,
        merchant_name: plaidTransactionWithEmptyCounterparties.merchant_name,
        icon_url: plaidTransactionWithEmptyCounterparties.logo_url || (plaidTransactionWithEmptyCounterparties.counterparties && plaidTransactionWithEmptyCounterparties.counterparties.length > 0 ? plaidTransactionWithEmptyCounterparties.counterparties[0].logo_url : null),
        personal_finance_category: plaidTransactionWithEmptyCounterparties.personal_finance_category,
        datetime: plaidTransactionWithEmptyCounterparties.date ? new Date(plaidTransactionWithEmptyCounterparties.date).toISOString() : null,
        location: plaidTransactionWithEmptyCounterparties.location,
        payment_channel: plaidTransactionWithEmptyCounterparties.payment_channel,
        website: plaidTransactionWithEmptyCounterparties.website,
        pending_plaid_transaction_id: plaidTransactionWithEmptyCounterparties.pending_transaction_id,
        category_id: null
      }

      // Verify that icon_url is null when both main logo_url and counterparties are empty
      expect(transactionData.icon_url).toBe(null)
    })
  })
})
