/**
 * Seed Script: Power User
 *
 * Creates a user with three Chase accounts (checking, savings, credit) and
 * ~150 transactions over the last 90 days. Inline fixtures — no
 * dependency on the deleted src/lib/plaid/mock-data files.
 *
 * Used by AI agents and humans to view a populated dashboard without
 * connecting real Plaid. The Plaid access_tokens stored on accounts/items
 * are placeholder strings; nothing in the app calls Plaid for this user
 * unless you explicitly trigger a sync.
 *
 * Run: pnpm seed:power
 */

import {
  createTestUser,
  printCredentials,
  upsertInstitution,
  insertPlaidItem,
  insertAccounts,
  insertTransactions,
} from './seed-utils.js';

// Deterministic 32-bit RNG (mulberry32). Same seed → same data.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHASE_INSTITUTION = {
  institution_id: 'ins_3', // Plaid's real Chase id; harmless to reuse
  name: 'Chase',
  logo: null,
  primary_color: '#117ACA',
  url: 'https://chase.com',
};

const CHASE_ACCOUNTS = [
  {
    account_id: 'mock_acc_chase_checking',
    name: 'Chase Total Checking',
    mask: '0000',
    type: 'depository',
    subtype: 'checking',
    balances: { available: 4823.17, current: 4823.17, iso_currency_code: 'USD', limit: null },
  },
  {
    account_id: 'mock_acc_chase_savings',
    name: 'Chase Savings',
    mask: '1111',
    type: 'depository',
    subtype: 'savings',
    balances: { available: 18450.00, current: 18450.00, iso_currency_code: 'USD', limit: null },
  },
  {
    account_id: 'mock_acc_chase_credit',
    name: 'Chase Sapphire',
    mask: '2222',
    type: 'credit',
    subtype: 'credit card',
    balances: { available: 9123.40, current: 876.60, iso_currency_code: 'USD', limit: 10000 },
  },
];

// Each entry: a category bucket with merchants and amount range.
// `target` = which account_id to charge (or income source).
// Sign convention: positive = outflow, negative = inflow (Plaid).
const SPEND_PATTERNS = [
  // Recurring monthly bills (predictable cadence)
  { kind: 'monthly', dom: 1,  target: 'mock_acc_chase_checking', name: 'Online Rent Payment', merchant: 'Rent', amount: 1850, pfc: ['RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_RENT'] },
  { kind: 'monthly', dom: 5,  target: 'mock_acc_chase_checking', name: 'Verizon Wireless',     merchant: 'Verizon', amount: 85, pfc: ['RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_TELEPHONE'] },
  { kind: 'monthly', dom: 12, target: 'mock_acc_chase_checking', name: 'PG&E Utilities',       merchant: 'PG&E', amount: 124.50, pfc: ['RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'] },
  { kind: 'monthly', dom: 8,  target: 'mock_acc_chase_credit',   name: 'Netflix',              merchant: 'Netflix', amount: 15.99, pfc: ['ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES'] },
  { kind: 'monthly', dom: 14, target: 'mock_acc_chase_credit',   name: 'Spotify USA',          merchant: 'Spotify', amount: 10.99, pfc: ['ENTERTAINMENT', 'ENTERTAINMENT_MUSIC_AND_AUDIO_SUBSCRIPTIONS'] },
  { kind: 'monthly', dom: 3,  target: 'mock_acc_chase_credit',   name: 'Equinox Membership',   merchant: 'Equinox', amount: 215, pfc: ['PERSONAL_CARE', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'] },

  // Income — biweekly paychecks (every 14 days)
  { kind: 'biweekly', dayOffset: 0, target: 'mock_acc_chase_checking', name: 'Direct Deposit — Acme Inc', merchant: 'Acme Inc', amount: -3650, pfc: ['INCOME', 'INCOME_WAGES'] },

  // Variable spending (frequency = avg per week)
  { kind: 'random', perWeek: 2.0,  target: 'mock_acc_chase_credit', merchants: [
      ['Whole Foods Market', 60, 145, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES']],
      ["Trader Joe's",       40, 95,  ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES']],
      ['Safeway',            25, 80,  ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES']],
    ] },
  { kind: 'random', perWeek: 4.0, target: 'mock_acc_chase_credit', merchants: [
      ['Chipotle',     11, 18, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT']],
      ['Sweetgreen',   13, 22, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT']],
      ['Shake Shack',  14, 28, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT']],
      ['Joe & The Juice', 9, 16, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT']],
      ['Tartine Bakery', 12, 32, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT']],
    ] },
  { kind: 'random', perWeek: 5.0, target: 'mock_acc_chase_credit', merchants: [
      ['Starbucks',    4, 9,  ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE']],
      ['Blue Bottle',  5, 11, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE']],
      ['Philz Coffee', 5, 10, ['FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE']],
    ] },
  { kind: 'random', perWeek: 1.2, target: 'mock_acc_chase_credit', merchants: [
      ['Uber',  9, 38, ['TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES']],
      ['Lyft',  7, 32, ['TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES']],
    ] },
  { kind: 'random', perWeek: 0.4, target: 'mock_acc_chase_credit', merchants: [
      ['Shell',        38, 62, ['TRANSPORTATION', 'TRANSPORTATION_GAS']],
      ['Chevron',      35, 58, ['TRANSPORTATION', 'TRANSPORTATION_GAS']],
    ] },
  { kind: 'random', perWeek: 1.6, target: 'mock_acc_chase_credit', merchants: [
      ['Amazon',       18, 142, ['GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES']],
      ['Target',       22, 88,  ['GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_DEPARTMENT_STORES']],
      ['Apple',        25, 240, ['GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_ELECTRONICS']],
      ['CVS Pharmacy', 8,  35,  ['GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_PHARMACIES_AND_CONVENIENCE_STORES']],
    ] },

  // Transfers between checking and savings (weekly-ish)
  { kind: 'random', perWeek: 0.5, target: 'mock_acc_chase_checking', merchants: [
      ['Online Transfer to Savings', 200, 500, ['TRANSFER_OUT', 'TRANSFER_OUT_ACCOUNT_TRANSFER']],
    ] },
  { kind: 'random', perWeek: 0.5, target: 'mock_acc_chase_savings', merchants: [
      ['Interest Earned', -3, -12, ['INCOME', 'INCOME_INTEREST_EARNED']],
    ] },

  // Credit card statement payment (monthly, from checking)
  { kind: 'monthly', dom: 22, target: 'mock_acc_chase_checking', name: 'Chase Credit Card Pmt', merchant: 'Chase', amount: 850, pfc: ['LOAN_PAYMENTS', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'] },
];

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }

function toIso(date) {
  // YYYY-MM-DDTHH:MM:SS.000Z
  return date.toISOString();
}

function buildTransactions(accountIdToInternalId) {
  const txs = [];
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 90);
  start.setUTCHours(0, 0, 0, 0);

  const random = rng(0xcafef00d);

  // Helper to emit one transaction. Patterns above use Plaid's sign
  // convention (positive = outflow). The DB stores the inverse — see
  // src/lib/plaid/transactionSync/buildRows.ts:76 — so flip here, just
  // like real sync does.
  let counter = 0;
  function emit({ accountPlaidId, name, merchant, amount, pfc, dt }) {
    const internalAccountId = accountIdToInternalId.get(accountPlaidId);
    if (!internalAccountId) return;
    counter += 1;
    const dbAmount = Math.round(-amount * 100) / 100;
    txs.push({
      accountId: internalAccountId,
      transaction_id: `mock_tx_power_${counter.toString().padStart(4, '0')}`,
      name,
      amount: dbAmount,
      iso_currency_code: 'USD',
      pending: false,
      merchant_name: merchant,
      logo_url: null,
      personal_finance_category: pfc ? { primary: pfc[0], detailed: pfc[1], confidence_level: 'HIGH' } : null,
      datetime: toIso(dt),
      payment_channel: dbAmount > 0 ? 'other' : 'in store',
    });
  }

  // Walk every day in the 90-day window
  for (let day = 0; day < 90; day += 1) {
    const dt = new Date(start);
    dt.setUTCDate(dt.getUTCDate() + day);
    const dom = dt.getUTCDate();

    for (const pattern of SPEND_PATTERNS) {
      if (pattern.kind === 'monthly' && pattern.dom === dom) {
        emit({
          accountPlaidId: pattern.target,
          name: pattern.name,
          merchant: pattern.merchant,
          amount: pattern.amount,
          pfc: pattern.pfc,
          dt,
        });
      } else if (pattern.kind === 'biweekly') {
        // Anchor: day 0 + dayOffset, then every 14 days
        if ((day - (pattern.dayOffset || 0)) >= 0 && (day - (pattern.dayOffset || 0)) % 14 === 0) {
          emit({
            accountPlaidId: pattern.target,
            name: pattern.name,
            merchant: pattern.merchant,
            amount: pattern.amount,
            pfc: pattern.pfc,
            dt,
          });
        }
      } else if (pattern.kind === 'random') {
        // Bernoulli per day with p = perWeek/7
        const p = pattern.perWeek / 7;
        if (random() < p) {
          const merchant = pattern.merchants[Math.floor(random() * pattern.merchants.length)];
          const [merchantName, lo, hi, pfc] = merchant;
          // Vary amount uniformly between lo..hi, rounded to cents
          const amount = lo + (hi - lo) * random();
          // Spread within the day (random hour) for realistic timeline
          const hour = Math.floor(random() * 14) + 8; // 8am–10pm
          const minute = Math.floor(random() * 60);
          const stamped = new Date(dt);
          stamped.setUTCHours(hour, minute, 0, 0);
          emit({
            accountPlaidId: pattern.target,
            name: merchantName,
            merchant: merchantName,
            amount,
            pfc,
            dt: stamped,
          });
        }
      }
    }
  }

  return txs;
}

async function main() {
  console.log('\n[seed] Seeding power user...\n');

  const email = 'test-power@zervo.test';
  const password = 'TestPower123!';
  const name = 'Sam (Power Test)';

  const user = await createTestUser({ email, password, name });

  const institution = await upsertInstitution(CHASE_INSTITUTION);
  console.log(`[seed] Institution upserted: ${institution.name}`);

  const plaidItem = await insertPlaidItem({
    userId: user.id,
    itemId: 'mock-item-power-chase',
    accessToken: 'mock-access-power-chase',
  });
  console.log(`[seed] Plaid item created: ${plaidItem.id}`);

  const accounts = await insertAccounts({
    userId: user.id,
    plaidItemId: plaidItem.id,
    itemId: 'mock-item-power-chase',
    institutionId: institution.id,
    accounts: CHASE_ACCOUNTS,
  });
  console.log(`[seed] Inserted ${accounts.length} accounts`);

  const accountIdToInternalId = new Map(accounts.map(a => [a.account_id, a.id]));
  const txs = buildTransactions(accountIdToInternalId);
  console.log(`[seed] Generated ${txs.length} transactions`);

  await insertTransactions(txs);

  printCredentials({
    scenario: 'Power User',
    email,
    password,
    userId: user.id,
    notes: [
      '3 Chase accounts: checking, savings, credit card',
      `${txs.length} transactions over the last 90 days`,
      'Realistic merchants + Plaid personal_finance_category set',
      'Sign in: dev-only email/password form on /auth (NODE_ENV !== production)',
    ],
  });
}

main().catch(err => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});
