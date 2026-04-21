/**
 * Brand identity constants. Import these anywhere the product name,
 * support email, or legal entity appears in user-facing copy — never
 * hardcode the brand name directly. This keeps a future rebrand to a
 * single-file change.
 */

export const BRAND = {
  /** Product name as it appears in sentences: "Welcome to Zervo." */
  name: 'Zervo',
  /**
   * Legal contracting party for ToS + copyright. Until an LLC is formed,
   * this is the owner as a sole proprietor using a DBA. Update to the
   * entity name (e.g. "Zervo Finance LLC") after incorporation.
   */
  legalName: 'Adarsh Nair d/b/a Zervo',
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
  governingState: 'New York',
  /** City + state where arbitration is conducted and venue lies. */
  venue: 'Nassau County, New York',
  /**
   * Physical mailing address for legal notices and privacy complaints.
   *
   * Pre-LLC we deliberately do not publish a home address — disclose on
   * request only. Replace with the registered-agent or business address
   * once the LLC is formed (before onboarding paying users).
   */
  mailingAddress: 'Available upon request via support@zervo.app',
} as const;

export type Legal = typeof LEGAL;
