/**
 * Ambient type declarations for the (JS) Plaid client wrapper.
 *
 * Keep in sync with `src/lib/plaid/client.js`. Only declares the public
 * surface consumed by TypeScript call sites. Return types are intentionally
 * loose (`Record<string, unknown>`) — each caller narrows them at the
 * seam where the data enters domain logic.
 */

export const PLAID_ENV: string;
export const PLAID_CLIENT_ID: string | undefined;
export const PLAID_SECRET: string | undefined;

export function getPlaidClient(): unknown;

export function createLinkToken(
  userId: string,
  products?: string[],
  accountFilters?: unknown,
  accessToken?: string | null
): Promise<Record<string, unknown>>;

export function exchangePublicToken(
  publicToken: string
): Promise<Record<string, unknown>>;

export function getAccounts(
  accessToken: string
): Promise<{ accounts?: Array<Record<string, unknown>> } & Record<string, unknown>>;

export function getInstitution(
  institutionId: string
): Promise<Record<string, unknown>>;

export function getTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
  accountIds?: string[] | null
): Promise<{ transactions?: Array<Record<string, unknown>> } & Record<string, unknown>>;

export function syncTransactions(
  accessToken: string,
  cursor?: string | null
): Promise<{
  added?: Array<Record<string, unknown>>;
  modified?: Array<Record<string, unknown>>;
  removed?: Array<Record<string, unknown>>;
  next_cursor?: string | null;
  has_more?: boolean;
} & Record<string, unknown>>;

export function getInvestmentsHoldings(
  accessToken: string
): Promise<Record<string, unknown>>;

export function getInvestmentTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
  accountIds?: string[] | null,
  options?: Record<string, unknown>
): Promise<Record<string, unknown>>;

export function removeItem(accessToken: string): Promise<Record<string, unknown>>;
