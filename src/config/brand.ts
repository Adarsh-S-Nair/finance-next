/**
 * Brand identity constants. Import these anywhere the product name,
 * support email, or legal entity appears in user-facing copy — never
 * hardcode the brand name directly. This keeps a future rebrand to a
 * single-file change.
 */

export const BRAND = {
  /** Product name as it appears in sentences: "Welcome to Zervo." */
  name: 'Zervo',
  /** Legal entity for copyright notices and ToS: "© Zervo Finance" */
  legalName: 'Zervo Finance',
  /** Apex domain, no protocol. Used in URLs and copy. */
  domain: 'zervo.app',
  /** Support inbox for contact links. */
  supportEmail: 'support@zervo.app',
  /** Passed to Plaid as `client_name` on link-token creation. */
  plaidClientName: 'Zervo',
} as const;

export type Brand = typeof BRAND;
