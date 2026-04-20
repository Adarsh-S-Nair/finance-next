"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCopy, FiRefreshCw } from "react-icons/fi";
import { authFetch } from "../../lib/api/fetch";
import { useToast } from "../providers/ToastProvider";

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

interface Props {
  isOpen: boolean;
  householdId: string | null;
  onClose: () => void;
}

export default function HouseholdInviteModal({ isOpen, householdId, onClose }: Props) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { setToast } = useToast();
  const loadedForIdRef = useRef<string | null>(null);

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

  const handleCopy = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.code);
      setToast({ title: "Copied invite code", variant: "success" });
    } catch {
      setToast({ title: "Couldn't copy", variant: "error" });
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
                <div className="flex items-center gap-3 mb-2">
                  {household && (
                    <span
                      className="block h-3 w-3 rounded-full"
                      style={{ backgroundColor: household.color }}
                      aria-hidden
                    />
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    {household?.name ?? "Household"}
                  </span>
                </div>
                <h1 className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]">
                  Invite to household
                </h1>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Share this 8-character code. Anyone signed in can redeem it to join.
                </p>

                <div className="mt-10">
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

                <div className="mt-10">
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
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
