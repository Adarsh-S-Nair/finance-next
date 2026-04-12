/**
 * Types for the account-disconnect pipeline.
 */

export interface DisconnectAccountParams {
  accountId: string;
  userId: string;
}

export interface DisconnectAccountResult {
  success: true;
  message: string;
  wasLastAccount: boolean;
  /** Set when we successfully deleted the account from the DB but couldn't
   *  remove the Plaid item upstream. The account is disconnected either way,
   *  but the orphaned plaid_item may need manual cleanup. */
  plaidRemovalWarning?: string;
}

/**
 * Error thrown when the orchestrator needs to terminate early and the HTTP
 * route should map the result to a specific status.
 */
export class DisconnectError extends Error {
  httpStatus: number;
  details?: string;

  constructor(message: string, httpStatus: number, details?: string) {
    super(message);
    this.name = 'DisconnectError';
    this.httpStatus = httpStatus;
    this.details = details;
  }
}
