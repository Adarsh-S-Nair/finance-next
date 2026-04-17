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

/**
 * Legal-specific constants referenced by the markdown in content/legal/.
 * Separate from BRAND because these are jurisdictional facts, not identity.
 *
 * IMPORTANT: The placeholder values below MUST be replaced before launching
 * to paying users. A fintech lawyer should confirm the chosen jurisdiction,
 * arbitration venue, and mailing address match your corporate structure.
 */
export const LEGAL = {
  /** US state whose laws govern the Terms and Privacy Policy. */
  governingState: '[TODO: governing state, e.g. "Delaware"]',
  /** City + state where arbitration is conducted and venue lies. */
  venue: '[TODO: venue, e.g. "New Castle County, Delaware"]',
  /**
   * Physical mailing address for legal notices and privacy complaints.
   * Several state privacy laws require this to be publicly posted. Can be
   * a business address or registered agent address.
   */
  mailingAddress: '[TODO: street address, city, state ZIP]',
} as const;

export type Legal = typeof LEGAL;
