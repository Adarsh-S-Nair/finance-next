"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FiBell, FiX } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { useHouseholds } from "./providers/HouseholdsProvider";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../lib/api/fetch";
import { supabase } from "../lib/supabase/client";
import { useToast } from "./providers/ToastProvider";
import { TOOLTIP_SURFACE_CLASSES } from "@zervo/ui";

type HouseholdSummary = { id: string; name: string; color: string };

type InviterProfile = {
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
};

type PendingInvitation = {
  id: string;
  created_at: string;
  expires_at: string;
  household: HouseholdSummary | null;
  invited_by: InviterProfile | null;
};

type ImpersonationGrant = {
  id: string;
  status: string;
  duration_seconds: number;
  requested_at: string;
  reason: string | null;
  requester_email: string | null;
  requester_first_name: string | null;
  requester_last_name: string | null;
};

type Counts = {
  count: number;
  unknownAccountCount: number;
  unmatchedTransferCount: number;
};

function inviterName(profile: InviterProfile | null) {
  if (!profile) return "Someone";
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Someone";
}

function requesterName(g: ImpersonationGrant): string {
  const parts = [g.requester_first_name, g.requester_last_name].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" ");
  if (g.requester_email) return g.requester_email.split("@")[0]!;
  return "An admin";
}

function formatDuration(seconds: number): string | null {
  if (seconds === 0) return null; // indefinite — caller drops the suffix
  if (seconds >= 86_400) return `${seconds / 86_400}d`;
  if (seconds >= 3_600) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.round(seconds / 60)}m`;
}

// Small red dot used to mark alert rows as unseen. Everything in the
// tray is treated as unseen right now — there's no server-side
// read-state, so the dot disappears only when the user acts on the
// alert (accepting an invite, navigating to /transactions, etc).
function UnseenDot() {
  return (
    <span
      aria-hidden
      className="block h-2 w-2 rounded-full flex-shrink-0 bg-[var(--color-danger)]"
    />
  );
}

export default function AlertsIcon() {
  const { profile } = useUser();
  const { refresh: refreshHouseholds } = useHouseholds();
  const { setToast } = useToast();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ count: 0, unknownAccountCount: 0, unmatchedTransferCount: 0 });
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [impersonationRequests, setImpersonationRequests] = useState<ImpersonationGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Badge + dropdown count excludes unmatched transfers on purpose —
  // those live in the dashboard Insights carousel now, not here.
  const totalCount =
    counts.unknownAccountCount + invitations.length + impersonationRequests.length;

  const loadInvitations = useCallback(async () => {
    try {
      const res = await authFetch("/api/invitations/pending");
      if (!res.ok) return;
      const data = await res.json();
      setInvitations((data.invitations ?? []) as PendingInvitation[]);
    } catch (err) {
      console.error("[alerts] pending invitations error", err);
    }
  }, []);

  const loadImpersonationRequests = useCallback(async () => {
    try {
      const res = await authFetch("/api/account/impersonation");
      if (!res.ok) return;
      const data = await res.json();
      const grants = (data.grants ?? []) as ImpersonationGrant[];
      // Endpoint returns pending + active; the alerts tray only cares
      // about pending (decisions to make). Active grants are managed
      // via the settings page.
      setImpersonationRequests(grants.filter((g) => g.status === "pending"));
    } catch (err) {
      console.error("[alerts] impersonation requests error", err);
    }
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const [countRes] = await Promise.all([
          fetch("/api/plaid/transactions/unknown-count"),
          loadInvitations(),
          loadImpersonationRequests(),
        ]);
        if (countRes.ok) {
          const data = await countRes.json();
          setCounts(data);
        }
      } catch (error) {
        console.error("[alerts] fetch error", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id, loadInvitations, loadImpersonationRequests]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live updates — when an admin requests impersonation access, or
  // someone invites this user to a household, the relevant tray section
  // refreshes the moment the row lands. We don't try to apply the change
  // payload directly because the REST endpoints hydrate joined data
  // (requester names, household name, etc.) that the WAL row doesn't
  // carry; refetching is simpler and the lists are small.
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`alerts-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "impersonation_grants",
          filter: `target_user_id=eq.${profile.id}`,
        },
        () => {
          loadImpersonationRequests();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_invitations",
          filter: `invited_user_id=eq.${profile.id}`,
        },
        () => {
          loadInvitations();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadImpersonationRequests, loadInvitations]);

  if (loading) return null;

  const jiggleVariants: Variants = {
    hover: { rotate: [0, -10, 10, -10, 10, 0], transition: { duration: 0.5, ease: "easeInOut" } },
    click: { rotate: [0, -20, 20, -20, 20, 0], scale: [1, 1.2, 1], transition: { duration: 0.4, ease: "easeInOut" } },
    idle: { rotate: 0, scale: 1 },
  };

  const acceptInvite = async (invite: PendingInvitation) => {
    if (!invite.household) return;
    try {
      setActingId(invite.id);
      const res = await authFetch(`/api/invitations/${invite.id}/accept`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ title: "Couldn't accept", description: data?.error, variant: "error" });
        return;
      }
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
      await refreshHouseholds();
      setToast({ title: `Joined ${invite.household.name}`, variant: "success" });
      setIsOpen(false);
      router.push(`/households/${invite.household.id}/accounts`);
    } finally {
      setActingId(null);
    }
  };

  const declineInvite = async (invite: PendingInvitation) => {
    try {
      setActingId(invite.id);
      const res = await authFetch(`/api/invitations/${invite.id}/decline`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ title: "Couldn't decline", description: data?.error, variant: "error" });
        return;
      }
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } finally {
      setActingId(null);
    }
  };

  const decideImpersonation = async (
    grant: ImpersonationGrant,
    action: "approve" | "deny",
  ) => {
    try {
      setActingId(grant.id);
      const res = await authFetch(`/api/account/impersonation/${grant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({
          title: action === "approve" ? "Couldn't approve" : "Couldn't deny",
          description: data?.error,
          variant: "error",
        });
        return;
      }
      setImpersonationRequests((prev) => prev.filter((g) => g.id !== grant.id));
      if (action === "approve") {
        setToast({
          title: `Approved ${requesterName(grant)}`,
          description: "They can now enter your account.",
          variant: "success",
        });
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        className="relative p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors duration-200 text-[var(--color-fg)] outline-none cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        whileHover="hover"
        whileTap="click"
        animate={isOpen ? "click" : "idle"}
        variants={jiggleVariants}
        aria-label="Notifications"
      >
        <FiBell className="w-5 h-5" />

        <AnimatePresence>
          {totalCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[var(--color-danger)] rounded-full border-2 border-[var(--color-content-bg)]"
              aria-label={`${totalCount} unread`}
            />
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop. Tapping anywhere outside the sheet closes
                it. The desktop dropdown's outside-click handler in the
                effect above covers the >= sm case, so this is only here
                to dim the page on small screens where the panel takes
                over the full bottom of the viewport. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] sm:hidden"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 1 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 1 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className={`fixed inset-x-0 bottom-0 z-50 max-h-[85vh] w-full rounded-t-2xl flex flex-col sm:absolute sm:bottom-auto sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 sm:max-h-none sm:rounded-2xl ${TOOLTIP_SURFACE_CLASSES}`}
            >
              {/* Drag handle on mobile so the sheet visually reads as
                  dismissable; on sm+ it's hidden (the dropdown floats). */}
              <div className="pt-2 pb-1 flex justify-center sm:hidden">
                <span className="block h-1 w-9 rounded-full bg-[var(--color-floating-muted)]/40" />
              </div>
              <div className="px-5 pt-3 sm:pt-4 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--color-floating-fg)]">Notifications</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden p-1 rounded-full text-[var(--color-floating-muted)] hover:text-[var(--color-floating-fg)] transition-colors"
                  aria-label="Close notifications"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:pb-2 sm:max-h-[420px]">
              {impersonationRequests.length > 0 && (
                <div>
                  {impersonationRequests.map((grant) => {
                    const dur = formatDuration(grant.duration_seconds);
                    return (
                      <div key={grant.id} className="px-5 py-3">
                        <div className="flex items-start gap-2.5">
                          <span className="pt-1.5">
                            <UnseenDot />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-floating-fg)]">
                              <span className="font-medium">{requesterName(grant)}</span>
                              <span className="text-[var(--color-floating-muted)]"> (Admin)</span>
                              {" requested "}
                              {dur ? `${dur} of ` : "indefinite "}
                              support access
                            </p>
                            {grant.reason && (
                              <p className="mt-1 text-xs italic text-[var(--color-floating-muted)]">
                                “{grant.reason}”
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={actingId === grant.id}
                                onClick={() => decideImpersonation(grant, "approve")}
                                className="inline-flex items-center rounded-full bg-[var(--color-floating-fg)] px-3 py-1 text-xs font-medium text-[var(--color-floating-bg)] transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actingId === grant.id}
                                onClick={() => decideImpersonation(grant, "deny")}
                                className="text-xs text-[var(--color-floating-muted)] hover:text-[var(--color-floating-fg)] transition-colors cursor-pointer"
                              >
                                Deny
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {invitations.length > 0 && (
                <div>
                  {invitations.map((invite) => (
                    <div key={invite.id} className="px-5 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="pt-1.5">
                          <UnseenDot />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-floating-fg)]">
                            <span className="font-medium">{inviterName(invite.invited_by)}</span>{" "}
                            invited you to{" "}
                            <span className="font-medium">
                              {invite.household?.name ?? "a household"}
                            </span>
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={actingId === invite.id}
                              onClick={() => acceptInvite(invite)}
                              className="inline-flex items-center rounded-full bg-[var(--color-floating-fg)] px-3 py-1 text-xs font-medium text-[var(--color-floating-bg)] transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={actingId === invite.id}
                              onClick={() => declineInvite(invite)}
                              className="text-xs text-[var(--color-floating-muted)] hover:text-[var(--color-floating-fg)] transition-colors cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {counts.unknownAccountCount > 0 && (
                <Link
                  href="/transactions?status=attention"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-5 py-3 hover:bg-[var(--color-floating-fg)]/[0.04] transition-colors"
                >
                  <UnseenDot />
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-[var(--color-floating-fg)] truncate">Unknown accounts</p>
                    <p className="text-xs text-[var(--color-floating-muted)] mt-0.5 truncate">
                      {counts.unknownAccountCount} transaction{counts.unknownAccountCount !== 1 ? "s" : ""} from unknown accounts
                    </p>
                  </div>
                  <span className="text-[var(--color-floating-muted)] text-base leading-none">&#8250;</span>
                </Link>
              )}

              {totalCount === 0 && (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-[var(--color-floating-muted)]">You&apos;re all caught up</p>
                </div>
              )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
