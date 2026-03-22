/**
 * Mock Plaid transaction fixture data
 * Realistic transactions with proper personal_finance_category shapes (v2)
 */

/**
 * Simple seeded pseudo-random for deterministic output.
 * Returns a float 0–1 based on seed + index.
 */
function seededRandom(seed, i) {
  const x = Math.sin(seed + i) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a date string N days ago from today.
 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Base transaction templates — realistic merchants with proper Plaid category shapes.
 */
const TRANSACTION_TEMPLATES = [
  // Groceries
  {
    merchant_name: 'Whole Foods Market',
    amount: 87.42,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_GROCERIES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'wholefoodsmarket.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/whole_foods_market_1197.png',
    location: {
      address: '525 N Lamar Blvd',
      city: 'Austin',
      region: 'TX',
      postal_code: '78703',
      country: 'US',
      lat: 30.2714,
      lon: -97.7537,
    },
  },
  {
    merchant_name: 'Trader Joe\'s',
    amount: 54.18,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_GROCERIES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'traderjoes.com',
    icon_url: null,
    location: {
      address: '4001 N Lamar Blvd',
      city: 'Austin',
      region: 'TX',
      postal_code: '78756',
      country: 'US',
      lat: 30.3076,
      lon: -97.7395,
    },
  },
  {
    merchant_name: 'HEB',
    amount: 123.67,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_GROCERIES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'heb.com',
    icon_url: null,
    location: {
      address: '6900 Brodie Ln',
      city: 'Austin',
      region: 'TX',
      postal_code: '78745',
      country: 'US',
      lat: 30.1876,
      lon: -97.8328,
    },
  },
  // Restaurants
  {
    merchant_name: 'Chipotle Mexican Grill',
    amount: 14.75,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_FAST_FOOD',
      confidence_level: 'VERY_HIGH',
    },
    website: 'chipotle.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/chipotle_mexican_grill_8248.png',
    location: { address: '200 E 6th St', city: 'Austin', region: 'TX', postal_code: '78701', country: 'US', lat: null, lon: null },
  },
  {
    merchant_name: 'Starbucks',
    amount: 7.45,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_COFFEE',
      confidence_level: 'VERY_HIGH',
    },
    website: 'starbucks.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/starbucks_956.png',
    location: { address: '1012 W 6th St', city: 'Austin', region: 'TX', postal_code: '78703', country: 'US', lat: null, lon: null },
  },
  {
    merchant_name: 'Uchi Austin',
    amount: 142.30,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_RESTAURANT',
      confidence_level: 'HIGH',
    },
    website: 'uchiaustin.com',
    icon_url: null,
    location: { address: '801 S Lamar Blvd', city: 'Austin', region: 'TX', postal_code: '78704', country: 'US', lat: null, lon: null },
  },
  // Transportation
  {
    merchant_name: 'Uber',
    amount: 18.42,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'TRANSPORTATION',
      detailed: 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'uber.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/uber_344.png',
    location: null,
  },
  {
    merchant_name: 'Shell',
    amount: 52.80,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'TRANSPORTATION',
      detailed: 'TRANSPORTATION_GAS_STATIONS',
      confidence_level: 'VERY_HIGH',
    },
    website: 'shell.com',
    icon_url: null,
    location: { address: '2900 S Lamar Blvd', city: 'Austin', region: 'TX', postal_code: '78704', country: 'US', lat: null, lon: null },
  },
  // Shopping
  {
    merchant_name: 'Amazon',
    amount: 67.99,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'GENERAL_MERCHANDISE',
      detailed: 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'amazon.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/amazon_1387.png',
    location: null,
  },
  {
    merchant_name: 'Target',
    amount: 93.12,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'GENERAL_MERCHANDISE',
      detailed: 'GENERAL_MERCHANDISE_SUPERSTORES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'target.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/target_10.png',
    location: { address: '5621 Brodie Ln', city: 'Austin', region: 'TX', postal_code: '78745', country: 'US', lat: null, lon: null },
  },
  {
    merchant_name: 'Costco',
    amount: 187.44,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'GENERAL_MERCHANDISE',
      detailed: 'GENERAL_MERCHANDISE_SUPERSTORES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'costco.com',
    icon_url: null,
    location: { address: '6929 N IH 35', city: 'Austin', region: 'TX', postal_code: '78753', country: 'US', lat: null, lon: null },
  },
  // Entertainment
  {
    merchant_name: 'Netflix',
    amount: 22.99,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'ENTERTAINMENT',
      detailed: 'ENTERTAINMENT_TV_AND_MOVIES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'netflix.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/netflix_73.png',
    location: null,
  },
  {
    merchant_name: 'Spotify',
    amount: 10.99,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'ENTERTAINMENT',
      detailed: 'ENTERTAINMENT_MUSIC',
      confidence_level: 'VERY_HIGH',
    },
    website: 'spotify.com',
    icon_url: 'https://plaid-merchant-logos.plaid.com/spotify_1706.png',
    location: null,
  },
  // Bills & Utilities
  {
    merchant_name: 'Austin Energy',
    amount: 112.33,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'HOME',
      detailed: 'HOME_UTILITIES',
      confidence_level: 'HIGH',
    },
    website: 'austinenergy.com',
    icon_url: null,
    location: null,
  },
  {
    merchant_name: 'AT&T',
    amount: 85.00,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'GENERAL_SERVICES',
      detailed: 'GENERAL_SERVICES_TELECOMMUNICATION_SERVICES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'att.com',
    icon_url: null,
    location: null,
  },
  // Health & Fitness
  {
    merchant_name: 'Planet Fitness',
    amount: 24.99,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'PERSONAL_CARE',
      detailed: 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS',
      confidence_level: 'VERY_HIGH',
    },
    website: 'planetfitness.com',
    icon_url: null,
    location: null,
  },
  {
    merchant_name: 'CVS Pharmacy',
    amount: 31.87,
    payment_channel: 'in store',
    personal_finance_category: {
      primary: 'PERSONAL_CARE',
      detailed: 'PERSONAL_CARE_PHARMACIES',
      confidence_level: 'VERY_HIGH',
    },
    website: 'cvs.com',
    icon_url: null,
    location: { address: '600 W 6th St', city: 'Austin', region: 'TX', postal_code: '78701', country: 'US', lat: null, lon: null },
  },
  // Travel
  {
    merchant_name: 'Southwest Airlines',
    amount: 234.00,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'TRAVEL',
      detailed: 'TRAVEL_AIRLINES_AND_AVIATION',
      confidence_level: 'VERY_HIGH',
    },
    website: 'southwest.com',
    icon_url: null,
    location: null,
  },
  {
    merchant_name: 'Marriott',
    amount: 189.00,
    payment_channel: 'online',
    personal_finance_category: {
      primary: 'TRAVEL',
      detailed: 'TRAVEL_LODGING',
      confidence_level: 'VERY_HIGH',
    },
    website: 'marriott.com',
    icon_url: null,
    location: null,
  },
  // Income/Credits
  {
    merchant_name: 'Direct Deposit',
    amount: -4500.00,
    payment_channel: 'other',
    personal_finance_category: {
      primary: 'INCOME',
      detailed: 'INCOME_WAGES',
      confidence_level: 'HIGH',
    },
    website: null,
    icon_url: null,
    location: null,
  },
];

/**
 * Generate a set of transactions for a given account ID.
 * @param {string} accountId - The account_id to assign transactions to
 * @param {number} count - Number of transactions to generate
 * @param {number} seed - Random seed for determinism
 * @param {number} startDaysAgo - Start transactions this many days ago
 */
export function generateTransactions(accountId, count = 60, seed = 42, startDaysAgo = 90) {
  const transactions = [];

  for (let i = 0; i < count; i++) {
    const templateIdx = Math.floor(seededRandom(seed, i * 3) * TRANSACTION_TEMPLATES.length);
    const template = TRANSACTION_TEMPLATES[templateIdx];

    // Slightly vary the amount for realism
    const amountVariation = 1 + (seededRandom(seed, i * 3 + 1) - 0.5) * 0.2;
    const amount = parseFloat((Math.abs(template.amount) * (template.amount < 0 ? -1 : 1) * amountVariation).toFixed(2));

    // Spread transactions over the date range
    const dayOffset = Math.floor(seededRandom(seed, i * 3 + 2) * startDaysAgo);
    const txDate = daysAgo(dayOffset);

    const txId = `mock_tx_${seed}_${i}`;

    transactions.push({
      account_id: accountId,
      transaction_id: txId,
      amount,
      iso_currency_code: 'USD',
      unofficial_currency_code: null,
      category: null,
      category_id: null,
      check_number: null,
      datetime: `${txDate}T${String(10 + Math.floor(seededRandom(seed, i) * 12)).padStart(2, '0')}:${String(Math.floor(seededRandom(seed, i + 1) * 59)).padStart(2, '0')}:00Z`,
      authorized_date: txDate,
      authorized_datetime: `${txDate}T00:00:00Z`,
      date: txDate,
      location: template.location || {
        address: null,
        city: null,
        region: null,
        postal_code: null,
        country: null,
        lat: null,
        lon: null,
        store_number: null,
      },
      name: template.merchant_name,
      merchant_name: template.merchant_name,
      merchant_entity_id: `mock_merchant_${templateIdx}`,
      logo_url: template.icon_url,
      website: template.website || null,
      payment_meta: {
        by_order_of: null,
        payee: null,
        payer: null,
        payment_method: null,
        payment_processor: null,
        ppd_id: null,
        reason: null,
        reference_number: null,
      },
      payment_channel: template.payment_channel,
      pending: false,
      pending_transaction_id: null,
      account_owner: null,
      transaction_code: null,
      transaction_type: amount < 0 ? 'special' : 'place',
      personal_finance_category: template.personal_finance_category,
      personal_finance_category_icon_url: template.icon_url,
      counterparties: [
        {
          name: template.merchant_name,
          type: 'merchant',
          logo_url: template.icon_url,
          website: template.website || null,
          entity_id: `mock_entity_${templateIdx}`,
          confidence_level: 'VERY_HIGH',
        },
      ],
    });
  }

  // Sort by date descending
  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Pre-generated sets for specific scenarios
 */
export const MOCK_TRANSACTIONS_POWER_USER = generateTransactions('mock_acc_checking_001', 90, 42, 90);
export const MOCK_TRANSACTIONS_CREDIT = generateTransactions('mock_acc_credit_001', 30, 77, 60);
