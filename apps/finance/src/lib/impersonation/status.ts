/**
 * Helpers for reasoning about the lifecycle state of an impersonation grant.
 * The DB stores raw status values; the app wants to know "is this grant
 * currently usable" (approved + not expired) vs. "actionable" (pending or
 * approved-and-not-expired) vs. "settled" (denied/revoked/expired).
 */

export type GrantStatus =
  | "pending"
  | "approved"
  | "denied"
  | "revoked"
  | "expired";

export type GrantRow = {
  id: string;
  status: string;
  expires_at: string | null;
  decided_at: string | null;
  duration_seconds: number;
  requested_at: string;
  reason: string | null;
};

export function isActive(grant: Pick<GrantRow, "status" | "expires_at">): boolean {
  if (grant.status !== "approved") return false;
  if (!grant.expires_at) return false;
  return new Date(grant.expires_at).getTime() > Date.now();
}

export function isOpen(grant: Pick<GrantRow, "status" | "expires_at">): boolean {
  if (grant.status === "pending") return true;
  if (isActive(grant)) return true;
  return false;
}
