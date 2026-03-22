/**
 * Seed Script: Power User
 *
 * Creates a user with multiple accounts, lots of transactions, and budgets.
 * Use this to test:
 * - Dashboard with full account list
 * - Transaction history and search
 * - Category breakdowns
 * - Account balances
 *
 * Run: npm run seed:power
 */

import {
  createTestUser,
  printCredentials,
  upsertInstitution,
  insertPlaidItem,
  insertAccounts,
  insertTransactions,
} from './seed-utils.js';
import { MOCK_INSTITUTIONS } from '../../src/lib/plaid/mock-data/institutions.js';
import { MOCK_ACCOUNTS_POWER_USER } from '../../src/lib/plaid/mock-data/accounts.js';
import { generateTransactions } from '../../src/lib/plaid/mock-data/transactions.js';

async function main() {
  console.log('\n[seed] 🌱 Seeding power user...\n');

  const email = 'test-power@zentari.test';
  const password = 'TestPower123!';
  const name = 'Sam (Power Test)';

  const user = await createTestUser({ email, password, name });

  // Upsert Chase institution
  const chaseInstitution = await upsertInstitution(MOCK_INSTITUTIONS['ins_mock_chase']);
  console.log('[seed] ✓ Institution upserted:', chaseInstitution.name);

  // Create a Chase plaid item
  const plaidItem = await insertPlaidItem({
    userId: user.id,
    itemId: 'mock-item-power-chase',
    accessToken: 'mock-access-power-chase',
  });
  console.log('[seed] ✓ Plaid item created:', plaidItem.id);

  // Insert accounts (checking, savings, credit card)
  const accounts = await insertAccounts({
    userId: user.id,
    plaidItemId: plaidItem.id,
    itemId: 'mock-item-power-chase',
    institutionId: chaseInstitution.id,
    accounts: MOCK_ACCOUNTS_POWER_USER,
  });
  console.log(`[seed] ✓ Inserted ${accounts.length} accounts`);

  // Generate and insert transactions for each account
  const accountMap = new Map(
    accounts.map(acc => [acc.account_id, acc.id])
  );

  for (const account of accounts) {
    const count = account.type === 'credit' ? 40 : 90;
    const seed = account.account_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const txs = generateTransactions(account.account_id, count, seed, 90);

    const txsWithInternalId = txs.map(tx => ({
      ...tx,
      accountId: accountMap.get(tx.account_id),
    })).filter(tx => tx.accountId);

    await insertTransactions(txsWithInternalId);
  }

  // Create a Bank of America item too (second bank)
  const bofaInstitution = await upsertInstitution(MOCK_INSTITUTIONS['ins_mock_bofa']);
  const bofaPlaidItem = await insertPlaidItem({
    userId: user.id,
    itemId: 'mock-item-power-bofa',
    accessToken: 'mock-access-power-bofa',
  });

  const bofaSavingsAccount = {
    account_id: 'mock_acc_bofa_savings',
    name: 'BofA Savings',
    official_name: 'BANK OF AMERICA ADVANTAGE SAVINGS',
    mask: '2211',
    type: 'depository',
    subtype: 'savings',
    balances: {
      available: 9234.56,
      current: 9234.56,
      iso_currency_code: 'USD',
      limit: null,
    },
  };

  const bofaAccounts = await insertAccounts({
    userId: user.id,
    plaidItemId: bofaPlaidItem.id,
    itemId: 'mock-item-power-bofa',
    institutionId: bofaInstitution.id,
    accounts: [bofaSavingsAccount],
  });

  // Add some BofA transactions
  const bofaTxs = generateTransactions(bofaSavingsAccount.account_id, 20, 999, 60);
  await insertTransactions(
    bofaTxs.map(tx => ({ ...tx, accountId: bofaAccounts[0].id }))
  );

  printCredentials({
    scenario: 'Power User',
    email,
    password,
    userId: user.id,
    notes: [
      '3 accounts at Chase (checking, savings, credit card)',
      '1 account at Bank of America (savings)',
      '~240 transactions spread over the last 90 days',
      'Real-looking merchants: Whole Foods, Amazon, Netflix, Uber, etc.',
      `App URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`,
    ],
  });
}

main().catch(err => {
  console.error('[seed] ❌ Error:', err.message);
  process.exit(1);
});
