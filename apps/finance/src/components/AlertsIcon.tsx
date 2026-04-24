"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FiBell } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { useHouseholds } from "./providers/HouseholdsProvider";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../lib/api/fetch";
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
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Badge + dropdown count excludes unmatched transfers on purpose —
  // those live in the dashboard Insights carousel now, not here.
  const totalCount = counts.unknownAccountCount + invitations.length;

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

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const [countRes] = await Promise.all([
          fetch("/api/plaid/transactions/unknown-count"),
          loadInvitations(),
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
  }, [profile?.id, loadInvitations]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-fg)] rounded-full border-2 border-[var(--color-content-bg)]"
            />
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
            className={`absolute top-full right-0 mt-2 w-80 z-50 overflow-hidden ${TOOLTIP_SURFACE_CLASSES}`}
          >
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-sm font-medium text-[var(--color-floating-fg)]">Notifications</h3>
            </div>

            <div className="max-h-[420px] overflow-y-auto pb-2">
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
        )}
      </AnimatePresence>
    </div>
  );
}
