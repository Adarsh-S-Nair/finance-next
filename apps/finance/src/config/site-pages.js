import { BRAND } from './brand';

export const SITE_PAGES = {
  '/dashboard': {
    title: 'Dashboard', // Used for document title (tab)
    header: null, // Dashboard has dynamic header, handled by page component
  },
  '/transactions': {
    title: 'Transactions',
    header: null,
  },
  '/accounts': {
    title: 'Accounts',
    header: 'Accounts',
  },
  '/budgets': {
    title: 'Budgets',
    header: 'Budgets',
  },
  '/settings': {
    title: 'Settings',
    header: 'Settings',
  },
  '/investments': {
    title: 'Investments',
    header: 'Investments',
  },
  // Add other routes as needed
};

export const DEFAULT_TITLE = BRAND.name;
