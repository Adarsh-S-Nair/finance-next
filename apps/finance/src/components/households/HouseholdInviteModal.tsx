"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { FiX, FiCopy, FiRefreshCw, FiUserCheck } from "react-icons/fi";
import { authFetch } from "../../lib/api/fetch";
import { useToast } from "../providers/ToastProvider";
import { Button } from "@zervo/ui";
type Invitation = {
  id: string;
  code: string;
  expires_at: string;
};

type Household = {
  id: string;
  name: string;
  color: string;
};

type LookupUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type Mode = "email" | "code";

interface Props {
  isOpen: boolean;
  householdId: string | null;
  onClose: () => void;
}

function formatName(user: LookupUser) {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.email || "Member";
}

function initialsFor(user: LookupUser) {
  if (user.first_name && user.last_name) return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  if (user.first_name) return user.first_name[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

export default function HouseholdInviteModal({ isOpen, householdId, onClose }: Props) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<
    | { status: "idle" }
    | { status: "searching" }
    | { status: "match"; user: LookupUser; alreadyMember: boolean }
    | { status: "none" }
  >({ status: "idle" });
  const [adding, setAdding] = useState(false);
  const { setToast } = useToast();
  const loadedForIdRef = useRef<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const loadExisting = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const [householdRes, invitesRes] = await Promise.all([
        authFetch(`/api/households/${id}`),
        authFetch(`/api/households/${id}/invitations`),
      ]);
      if (householdRes.ok) {
        const data = await householdRes.json();
        setHousehold(data.household);
      }
      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvitation((data.invitations ?? [])[0] ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvite = useCallback(async () => {
    if (!householdId) return;
    try {
      setCreating(true);
      const res = await authFetch(`/api/households/${householdId}/invitations`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ title: "Couldn't create invite", description: data?.error, variant: "error" });
        return;
      }
      setInvitation(data.invitation);
    } finally {
      setCreating(false);
    }
  }, [householdId, setToast]);

  useEffect(() => {
    if (!isOpen) return;
    if (!householdId) return;
    if (loadedForIdRef.current === householdId) return;
    loadedForIdRef.current = householdId;
    setInvitation(null);
    setHousehold(null);
    setEmail("");
    setLookup({ status: "idle" });
    setMode("email");
    loadExisting(householdId);
  }, [isOpen, householdId, loadExisting]);

  useEffect(() => {
    if (!isOpen) {
      loadedForIdRef.current = null;
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (mode === "email" && isOpen) {
      const t = setTimeout(() => emailInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [mode, isOpen]);

  // Debounced lookup: only fires after the user stops typing for 300ms.
  useEffect(() => {
    if (!householdId) return;
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setLookup({ status: "idle" });
      return;
    }
    setLookup({ status: "searching" });
    const handle = setTimeout(async () => {
      try {
        const res = await authFetch(
          `/api/households/${householdId}/invitations/lookup?email=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setLookup({ status: "none" });
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setLookup({
            status: "match",
            user: data.user as LookupUser,
            alreadyMember: !!data.already_member,
          });
        } else {
          setLookup({ status: "none" });
        }
      } catch {
        setLookup({ status: "none" });
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [email, householdId]);

  const handleCopy = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.code);
      setToast({ title: "Copied invite code", variant: "success" });
    } catch {
      setToast({ title: "Couldn't copy", variant: "error" });
    }
  };

  const handleSendEmail = async () => {
    if (!householdId) return;
    if (lookup.status !== "match" || lookup.alreadyMember) return;
    try {
      setAdding(true);
      const res = await authFetch(`/api/households/${householdId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          title: "Couldn't send invite",
          description: data?.error,
          variant: "error",
        });
        return;
      }
      setToast({
        title: `Invite sent to ${formatName(lookup.user)}`,
        variant: "success",
      });
      setEmail("");
      setLookup({ status: "idle" });
      onClose();
    } finally {
      setAdding(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="household-invite-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-[var(--color-content-bg)] overflow-y-auto"
        >
          <button
            type="button"
            onClick={onClose}
            className="fixed top-5 right-5 md:top-6 md:right-6 z-10 p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>

          <div className="min-h-screen flex items-center justify-center px-6 py-20">
            <div className="w-full max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]">
                  Invite to{" "}
                  <span className="text-[var(--color-fg)]">
                    {household?.name ?? "your"}
                  </span>{" "}
                  household
                </h1>

                {/* Segmented tabs — flat, minimal */}
                <div className="mt-8 flex items-center gap-6 text-sm border-b border-[var(--color-border)]">
                  {(["email", "code"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={clsx(
                        "relative pb-3 transition-colors cursor-pointer",
                        mode === m
                          ? "text-[var(--color-fg)] font-medium"
                          : "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
                      )}
                    >
                      {m === "email" ? "By email" : "By code"}
                      {mode === m && (
                        <motion.span
                          layoutId="invite-tab-underline"
                          className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--color-fg)]"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {mode === "email" ? (
                  <>
                    <div className="mt-8">
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@email.com"
                        autoComplete="off"
                        className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-3 text-xl tracking-tight text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/40 outline-none focus:border-[var(--color-fg)] transition-colors"
                      />

                      {/* Lookup feedback — fades in/out, stays reserved space */}
                      <div className="mt-3 min-h-[40px] text-xs">
                        {lookup.status === "searching" && (
                          <span className="text-[var(--color-muted)]">Looking up…</span>
                        )}
                        {lookup.status === "match" && (
                          <motion.div
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2.5"
                          >
                            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-[10px] font-semibold text-[var(--color-on-accent,white)]">
                              {lookup.user.avatar_url ? (

                                <img
                                  src={lookup.user.avatar_url}
                                  alt={formatName(lookup.user)}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{initialsFor(lookup.user)}</span>
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-[var(--color-fg)] truncate">
                                {formatName(lookup.user)}
                              </p>
                              {lookup.alreadyMember && (
                                <p className="text-[11px] text-[var(--color-muted)] flex items-center gap-1">
                                  <FiUserCheck className="h-3 w-3" />
                                  Already a member
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                        {lookup.status === "none" && email.trim().length > 0 && (
                          <span className="text-[var(--color-muted)]">
                            No account matches that email yet.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 h-9">
                      {lookup.status === "match" && !lookup.alreadyMember && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Button onClick={handleSendEmail} loading={adding}>
                            Invite {lookup.user.first_name ?? "member"}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-6 text-sm text-[var(--color-muted)]">
                      Share this 8-character code. Anyone signed in can redeem it to join.
                    </p>

                    <div className="mt-6">
                      {loading ? (
                        <div className="h-14 flex items-center text-sm text-[var(--color-muted)]">
                          Loading invite…
                        </div>
                      ) : invitation ? (
                        <div className="border-b border-[var(--color-border)] pb-4">
                          <div className="flex items-start gap-4">
                            <button
                              type="button"
                              onClick={handleCopy}
                              className="flex-1 min-w-0 text-left group"
                            >
                              <p className="font-mono text-2xl tracking-[0.3em] uppercase text-[var(--color-fg)] break-all">
                                {invitation.code}
                              </p>
                              <p className="mt-2 text-xs text-[var(--color-muted)]">
                                Expires {new Date(invitation.expires_at).toLocaleDateString()}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={handleCopy}
                              aria-label="Copy code"
                              className="mt-1 p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
                            >
                              <FiCopy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-muted)] border-b border-[var(--color-border)] pb-4">
                          No active invite yet.
                        </p>
                      )}
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={createInvite}
                        disabled={creating || !householdId}
                        className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)] disabled:text-[var(--color-muted)] disabled:pointer-events-none cursor-pointer"
                      >
                        <FiRefreshCw
                          className={`h-4 w-4 transition-transform ${creating ? "animate-spin" : "group-hover:rotate-180"}`}
                        />
                        {invitation ? "Generate a new code" : "Create invite code"}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
