"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiBell, FiChevronLeft } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { useHouseholds } from "./providers/HouseholdsProvider";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
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
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);
  const bellControls = useAnimation();

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
    setMounted(true);
    const check = () => setIsMobile(window.matchMedia("(max-width: 639px)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Click-outside dismissal is for the desktop floating dropdown only.
  // On mobile the overlay is portaled to body and dismissed via its own
  // backdrop / chevron / Esc.
  useEffect(() => {
    if (isMobile) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  // Esc dismisses the mobile overlay (the only modal-style surface here).
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isMobile]);

  // Lock body scroll while the mobile overlay is up so the underlying
  // page doesn't scroll under the user's finger.
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen, isMobile]);

  // Jiggle the bell whenever the unread count INCREASES — a passive
  // realtime update should announce itself, not just sit there. Skip on
  // first paint (initial fetch fills the count) by gating on `loading`,
  // and skip when the count goes down (user dismissed/acted on something).
  useEffect(() => {
    if (loading) {
      prevCountRef.current = totalCount;
      return;
    }
    if (totalCount > prevCountRef.current) {
      bellControls.start({
        rotate: [0, -18, 18, -14, 14, -8, 8, 0],
        transition: { duration: 0.7, ease: "easeInOut" },
      });
    }
    prevCountRef.current = totalCount;
  }, [totalCount, loading, bellControls]);

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

  // The notification list — used in both the desktop floating dropdown
  // and the mobile fullscreen overlay so the rendering stays in one
  // place. `floating` controls the typography color tokens because the
  // desktop dropdown sits on a dark floating surface while the mobile
  // overlay is full-page on the regular content surface.
  const renderRows = (floating: boolean) => {
    const fg = floating ? "var(--color-floating-fg)" : "var(--color-fg)";
    const muted = floating ? "var(--color-floating-muted)" : "var(--color-muted)";
    const hoverBg = floating
      ? "hover:bg-[var(--color-floating-fg)]/[0.04]"
      : "hover:bg-[var(--color-fg)]/[0.04]";
    return (
      <>
        {impersonationRequests.length > 0 &&
          impersonationRequests.map((grant) => {
            const dur = formatDuration(grant.duration_seconds);
            return (
              <div key={grant.id} className="px-5 py-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="pt-1.5">
                    <UnseenDot />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: fg }}>
                      <span className="font-medium">{requesterName(grant)}</span>
                      <span style={{ color: muted }}> (Admin)</span>
                      {" requested "}
                      {dur ? `${dur} of ` : "indefinite "}
                      support access
                    </p>
                    {grant.reason && (
                      <p
                        className="mt-1 text-xs italic"
                        style={{ color: muted }}
                      >
                        “{grant.reason}”
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actingId === grant.id}
                        onClick={() => decideImpersonation(grant, "approve")}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        style={{
                          backgroundColor: fg,
                          color: floating
                            ? "var(--color-floating-bg)"
                            : "var(--color-bg)",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingId === grant.id}
                        onClick={() => decideImpersonation(grant, "deny")}
                        className="text-xs hover:underline disabled:opacity-50 cursor-pointer transition-colors"
                        style={{ color: muted }}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        {invitations.length > 0 &&
          invitations.map((invite) => (
            <div key={invite.id} className="px-5 py-3.5">
              <div className="flex items-start gap-2.5">
                <span className="pt-1.5">
                  <UnseenDot />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: fg }}>
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
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                      style={{
                        backgroundColor: fg,
                        color: floating
                          ? "var(--color-floating-bg)"
                          : "var(--color-bg)",
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={actingId === invite.id}
                      onClick={() => declineInvite(invite)}
                      className="text-xs hover:underline disabled:opacity-50 cursor-pointer transition-colors"
                      style={{ color: muted }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

        {counts.unknownAccountCount > 0 && (
          <Link
            href="/transactions?status=attention"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-2.5 px-5 py-3.5 transition-colors ${hoverBg}`}
          >
            <UnseenDot />
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm font-medium truncate" style={{ color: fg }}>
                Unknown accounts
              </p>
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: muted }}
              >
                {counts.unknownAccountCount} transaction
                {counts.unknownAccountCount !== 1 ? "s" : ""} from unknown accounts
              </p>
            </div>
            <span className="text-base leading-none" style={{ color: muted }}>
              &#8250;
            </span>
          </Link>
        )}

        {totalCount === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm" style={{ color: muted }}>
              You&apos;re all caught up
            </p>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        className="relative p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors duration-200 text-[var(--color-fg)] outline-none cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ rotate: [0, -10, 10, -10, 10, 0], transition: { duration: 0.5 } }}
        whileTap={{ rotate: [0, -20, 20, -20, 20, 0], scale: [1, 1.2, 1], transition: { duration: 0.4 } }}
        animate={bellControls}
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

      {/* Desktop floating dropdown — anchored under the bell icon. */}
      <AnimatePresence>
        {isOpen && !isMobile && (
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
            <div className="max-h-[420px] overflow-y-auto pb-2">{renderRows(true)}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile fullscreen overlay — portaled to body so it escapes any
          ancestor stacking context (transformed wrappers, sticky headers,
          etc.). Slides in from the right like a page transition.
          Chevron-left closes. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && isMobile && (
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                // iOS-feel cubic — fast settle without overshoot. Shorter
                // duration + transform-gpu + will-change push the slide
                // onto a compositor layer so it doesn't pay layout/paint
                // costs on each frame (the prior 0.22s ease-in-out was
                // dropping frames on lower-end mobile because the
                // notification list was repainting during the animation).
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                style={{ willChange: "transform" }}
                className="fixed inset-0 z-[80] bg-[var(--color-content-bg)] flex flex-col transform-gpu"
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
              >
                <div className="sticky top-0 z-10 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-3 bg-[var(--color-content-bg)]">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-full text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.06] transition-colors"
                    aria-label="Back"
                  >
                    <FiChevronLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-base font-medium text-[var(--color-fg)]">Notifications</h2>
                </div>
                <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
                  {renderRows(false)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
