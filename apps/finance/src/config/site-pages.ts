import { BRAND } from './brand';

interface PageConfig {
  title: string;
  header: string | null;
}

export const SITE_PAGES: Record<string, PageConfig> = {
  '/today': {
    title: 'Today',
    header: null, // Today renders its own greeting header
  },
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
  '/goals': {
    title: 'Goals',
    header: 'Goals',
  },
  '/recurring': {
    title: 'Bills',
    header: 'Bills & Subscriptions',
  },
  '/settings': {
    title: 'Settings',
    header: 'Settings',
  },
  '/investments': {
    title: 'Investments',
    header: 'Investments',
  },
};

export const DEFAULT_TITLE = BRAND.name;
