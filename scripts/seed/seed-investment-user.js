/**
 * Seed Script: Investment User
 *
 * Creates a user with investment-heavy accounts at Charles Schwab:
 *   - Brokerage account with stocks and ETFs
 *   - Roth IRA with ETFs
 *   - Checking account (secondary)
 *
 * Use this to test:
 * - Portfolio / holdings view
 * - Investment performance charts
 * - Investment transactions
 * - Mixed depository + investment accounts
 *
 * Run: npm run seed:investor
 */

import {
  createTestUser,
  printCredentials,
  upsertInstitution,
  insertPlaidItem,
  insertAccounts,
  insertTransactions,
  insertPortfolio,
} from './seed-utils.js';
import { MOCK_INSTITUTIONS } from '../../src/lib/plaid/mock-data/institutions.js';
import {
  MOCK_ACCOUNTS_INVESTMENT,
  MOCK_ACCOUNTS_POWER_USER,
} from '../../src/lib/plaid/mock-data/accounts.js';
import { generateTransactions } from '../../src/lib/plaid/mock-data/transactions.js';
import {
  MOCK_SECURITIES,
  MOCK_HOLDINGS_BROKERAGE,
  MOCK_HOLDINGS_IRA,
} from '../../src/lib/plaid/mock-data/investments.js';

async function main() {
  console.log('\n[seed] 🌱 Seeding investment user...\n');

  const email = 'test-investor@zervo.test';
  const password = 'TestInvest123!';
  const name = 'Morgan (Investor Test)';

  const user = await createTestUser({ email, password, name });

  // Upsert Charles Schwab institution
  const schwabInstitution = await upsertInstitution(MOCK_INSTITUTIONS['ins_mock_schwab']);
  console.log('[seed] ✓ Institution upserted:', schwabInstitution.name);

  // Create a Schwab plaid item (investment accounts)
  const schwabPlaidItem = await insertPlaidItem({
    userId: user.id,
    itemId: 'mock-item-investor-schwab',
    accessToken: 'mock-access-investor-schwab',
  });
  console.log('[seed] ✓ Schwab plaid item created:', schwabPlaidItem.id);

  // Insert investment accounts (brokerage + IRA) + one checking account
  const checkingAccount = {
    account_id: 'mock_acc_checking_investor',
    name: 'Schwab Investor Checking',
    official_name: 'SCHWAB BANK HIGH YIELD INVESTOR CHECKING',
    mask: '4400',
    type: 'depository',
    subtype: 'checking',
    balances: {
      available: 12450.00,
      current: 12450.00,
      iso_currency_code: 'USD',
      limit: null,
    },
  };

  const allAccounts = [...MOCK_ACCOUNTS_INVESTMENT, checkingAccount];

  const accounts = await insertAccounts({
    userId: user.id,
    plaidItemId: schwabPlaidItem.id,
    itemId: 'mock-item-investor-schwab',
    institutionId: schwabInstitution.id,
    accounts: allAccounts,
  });
  console.log(`[seed] ✓ Inserted ${accounts.length} accounts`);

  // Map plaid account_id → internal UUID
  const accountMap = new Map(accounts.map(acc => [acc.account_id, acc.id]));

  // Insert checking transactions
  const checkingTxs = generateTransactions('mock_acc_checking_investor', 30, 1234, 60);
  await insertTransactions(
    checkingTxs.map(tx => ({ ...tx, accountId: accountMap.get('mock_acc_checking_investor') }))
  );

  // Insert holdings for each investment account
  const securities = Object.values(MOCK_SECURITIES);

  const brokerageAccountId = accountMap.get('mock_acc_brokerage_001');
  if (brokerageAccountId) {
    await insertPortfolio({
      accountId: brokerageAccountId,
      name: 'Schwab Brokerage',
      holdings: MOCK_HOLDINGS_BROKERAGE,
      securities,
    });
  }

  const iraAccountId = accountMap.get('mock_acc_ira_001');
  if (iraAccountId) {
    await insertPortfolio({
      accountId: iraAccountId,
      name: 'Schwab Roth IRA',
      holdings: MOCK_HOLDINGS_IRA,
      securities,
    });
  }

  printCredentials({
    scenario: 'Investment User',
    email,
    password,
    userId: user.id,
    notes: [
      '1 checking account at Schwab (~$12,450)',
      '1 brokerage account (~$87,432) with AAPL, MSFT, VOO, NVDA',
      '1 Roth IRA (~$43,211) with VTI, GOOGL',
      'Portfolio holdings seeded — visible in investments/portfolio views',
      '30 checking transactions over the last 60 days',
      `App URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`,
    ],
  });
}

main().catch(err => {
  console.error('[seed] ❌ Error:', err.message);
  process.exit(1);
});
