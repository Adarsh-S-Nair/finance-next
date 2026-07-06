import type * as React from "react";

export interface PlaidLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: ((data: unknown) => void) | null;
  onUpgradeNeeded?: (() => void) | null;
  /** Existing plaid_items.id — opens Link in update mode against it. */
  plaidItemId?: string | null;
  /** Products to request in update mode (upgrade flow). Ignored when reauth. */
  additionalProducts?: string[];
  /** Re-authentication (ITEM_LOGIN_REQUIRED recovery): plain re-login, no new consent. */
  reauth?: boolean;
  title?: string;
  description?: string;
}

export default function PlaidLinkModal(
  props: PlaidLinkModalProps,
): React.JSX.Element;
