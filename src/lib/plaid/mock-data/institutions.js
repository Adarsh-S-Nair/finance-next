/**
 * Mock Plaid institution fixture data
 * Used by mock-client.js to return realistic institution responses
 */

export const MOCK_INSTITUTIONS = {
  'ins_mock_chase': {
    institution_id: 'ins_mock_chase',
    name: 'Chase',
    products: ['transactions', 'investments', 'auth'],
    country_codes: ['US'],
    url: 'https://www.chase.com',
    primary_color: '#117ACA',
    logo: 'https://logo.clearbit.com/chase.com',
    routing_numbers: ['021000021'],
    oauth: false,
    status: {
      item_logins: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
      transactions_updates: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
    },
  },
  'ins_mock_bofa': {
    institution_id: 'ins_mock_bofa',
    name: 'Bank of America',
    products: ['transactions', 'auth'],
    country_codes: ['US'],
    url: 'https://www.bankofamerica.com',
    primary_color: '#E31837',
    logo: 'https://logo.clearbit.com/bankofamerica.com',
    routing_numbers: ['026009593'],
    oauth: false,
    status: {
      item_logins: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
      transactions_updates: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
    },
  },
  'ins_mock_schwab': {
    institution_id: 'ins_mock_schwab',
    name: 'Charles Schwab',
    products: ['transactions', 'investments', 'auth'],
    country_codes: ['US'],
    url: 'https://www.schwab.com',
    primary_color: '#00A0DF',
    logo: 'https://logo.clearbit.com/schwab.com',
    routing_numbers: ['121202211'],
    oauth: false,
    status: {
      item_logins: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
      transactions_updates: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
    },
  },
  'ins_mock_wellsfargo': {
    institution_id: 'ins_mock_wellsfargo',
    name: 'Wells Fargo',
    products: ['transactions', 'auth'],
    country_codes: ['US'],
    url: 'https://www.wellsfargo.com',
    primary_color: '#D71E28',
    logo: 'https://logo.clearbit.com/wellsfargo.com',
    routing_numbers: ['121000248'],
    oauth: false,
    status: {
      item_logins: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
      transactions_updates: { status: 'HEALTHY', last_status_change: '2024-01-01T00:00:00Z' },
    },
  },
};

export const DEFAULT_INSTITUTION_ID = 'ins_mock_chase';
