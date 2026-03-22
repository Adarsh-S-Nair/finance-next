/**
 * Seed Script: Empty / FTUX User
 *
 * Creates a user with no connected bank accounts.
 * Use this to test the First-Time User Experience (FTUX) flow:
 * - Onboarding screen
 * - Plaid Link connection
 * - Empty state dashboards
 *
 * Run: npm run seed:ftux
 */

import {
  createTestUser,
  printCredentials,
} from './seed-utils.js';

async function main() {
  console.log('\n[seed] 🌱 Seeding empty/FTUX user...\n');

  const email = 'test-ftux@zentari.test';
  const password = 'TestFTUX123!';
  const name = 'Alex (FTUX Test)';

  const user = await createTestUser({ email, password, name });

  // No accounts, no transactions — pure FTUX state
  // The user will see the connect-your-bank flow on first login

  printCredentials({
    scenario: 'Empty / FTUX User',
    email,
    password,
    userId: user.id,
    notes: [
      'No connected accounts — triggers the FTUX onboarding flow',
      'Use this to test Plaid Link connection from scratch',
      'In mock mode, connecting a bank will use fake mock data',
      `App URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`,
    ],
  });
}

main().catch(err => {
  console.error('[seed] ❌ Error:', err.message);
  process.exit(1);
});
