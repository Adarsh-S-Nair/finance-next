"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiUsers,
  FiUserPlus,
} from "react-icons/fi";
import { authFetch } from "../../lib/api/fetch";
import { useHouseholds } from "../providers/HouseholdsProvider";
import { useToast } from "../providers/ToastProvider";

type Mode = "menu" | "create" | "join";

type JoinPreview = {
  household: { id: string; name: string; member_count: number };
  invited_by: { first_name: string | null; last_name: string | null } | null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: Mode;
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)] ${className}`}
    >
      {children}
    </div>
  );
}

function OptionRow({
  icon,
  title,
  subtitle,
  onClick,
  index = 0,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  index?: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.04 }}
      whileHover={{ x: 2 }}
      className="group flex w-full items-center gap-4 py-4 text-left cursor-pointer"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex-shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-[var(--color-fg)] truncate">{title}</div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5">{subtitle}</div>
      </div>
      <FiChevronRight className="h-4 w-4 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors flex-shrink-0" />
    </motion.button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] cursor-pointer"
    >
      <FiChevronLeft className="h-4 w-4" />
      Back
    </button>
  );
}

export default function HouseholdSwitcherModal({
  isOpen,
  onClose,
  initialMode = "menu",
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const { refresh } = useHouseholds();
  const { setToast } = useToast();

  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Reset state shortly after close so exit animation can play.
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      return;
    }
    const t = setTimeout(() => {
      setName("");
      setCode("");
      setPreview(null);
      setPreviewError(null);
      setSubmitError(null);
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen, initialMode]);

  // Autofocus the active step's input.
  useEffect(() => {
    if (!isOpen) return;
    if (mode === "create") nameRef.current?.focus();
    if (mode === "join") codeRef.current?.focus();
  }, [isOpen, mode]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setBusy(true);
      setSubmitError(null);
      const response = await authFetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(data?.error || "Couldn't create household");
        return;
      }
      await refresh();
      setToast({ title: "Household created", variant: "success" });
      onClose();
      router.push(`/households/${data.household.id}`);
    } finally {
      setBusy(false);
    }
  };

  const fetchPreview = async (next: string) => {
    const normalized = next.trim().toUpperCase();
    if (!normalized) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const response = await authFetch(
        `/api/households/join?code=${encodeURIComponent(normalized)}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPreview(null);
        setPreviewError(data?.error || "Invalid invite code");
        return;
      }
      setPreview(data as JoinPreview);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoin = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    try {
      setBusy(true);
      setSubmitError(null);
      const response = await authFetch("/api/households/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(data?.error || "Couldn't join");
        return;
      }
      await refresh();
      setToast({ title: "Joined household", variant: "success" });
      onClose();
      router.push(`/households/${data.household_id}`);
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="household-switcher-overlay"
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
              <AnimatePresence mode="wait">
                {mode === "menu" && (
                  <motion.div
                    key="menu"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.h1
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
                    >
                      Households
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.08 }}
                      className="mt-2 text-sm text-[var(--color-muted)]"
                    >
                      Share a combined view with family, partners, or roommates.
                    </motion.p>

                    <div className="mt-10">
                      <SectionLabel className="mb-2">Get started</SectionLabel>
                      <div className="divide-y divide-[var(--color-border)]">
                        <OptionRow
                          index={0}
                          icon={<FiUsers className="h-4 w-4" />}
                          title="Create a household"
                          subtitle="Start a new household and invite others"
                          onClick={() => setMode("create")}
                        />
                        <OptionRow
                          index={1}
                          icon={<FiUserPlus className="h-4 w-4" />}
                          title="Join with a code"
                          subtitle="Use an invite from an existing member"
                          onClick={() => setMode("join")}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {mode === "create" && (
                  <motion.div
                    key="create"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BackLink onClick={() => setMode("menu")} />
                    <motion.h1
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
                    >
                      Name your household
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.08 }}
                      className="mt-2 text-sm text-[var(--color-muted)]"
                    >
                      You can change this later.
                    </motion.p>

                    <div className="mt-10">
                      <input
                        ref={nameRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && name.trim() && !busy) handleCreate();
                        }}
                        placeholder="e.g. Family, Apartment 4B"
                        maxLength={60}
                        className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-3 text-2xl font-medium tracking-tight text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/40 outline-none focus:border-[var(--color-fg)] transition-colors"
                      />
                      {submitError && (
                        <p className="mt-3 text-xs text-[var(--color-danger)]">{submitError}</p>
                      )}
                    </div>

                    <div className="mt-10 h-9">
                      {name.trim().length > 0 && (
                        <motion.button
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          type="button"
                          onClick={handleCreate}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-fg)] px-5 py-2 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          {busy ? "Creating…" : "Create household"}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}

                {mode === "join" && (
                  <motion.div
                    key="join"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BackLink onClick={() => setMode("menu")} />
                    <motion.h1
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
                    >
                      Enter invite code
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.08 }}
                      className="mt-2 text-sm text-[var(--color-muted)]"
                    >
                      Ask a member of the household for their 8-character code.
                    </motion.p>

                    <div className="mt-10">
                      <input
                        ref={codeRef}
                        value={code}
                        onChange={(e) => {
                          const next = e.target.value.toUpperCase();
                          setCode(next);
                          setPreview(null);
                          setPreviewError(null);
                          setSubmitError(null);
                        }}
                        onBlur={() => fetchPreview(code)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (preview) handleJoin();
                            else fetchPreview(code);
                          }
                        }}
                        placeholder="ABCD1234"
                        maxLength={12}
                        className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-3 text-2xl font-mono tracking-[0.24em] uppercase text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/30 outline-none focus:border-[var(--color-fg)] transition-colors"
                      />
                      {previewLoading && (
                        <p className="mt-3 text-xs text-[var(--color-muted)]">Looking up invite…</p>
                      )}
                      {(previewError || submitError) && (
                        <p className="mt-3 text-xs text-[var(--color-danger)]">
                          {submitError || previewError}
                        </p>
                      )}
                      {preview && !previewError && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 text-sm text-[var(--color-fg)]"
                        >
                          Joining{" "}
                          <span className="font-medium">{preview.household.name}</span>
                          <span className="text-[var(--color-muted)]">
                            {" · "}
                            {preview.household.member_count} member
                            {preview.household.member_count === 1 ? "" : "s"}
                            {preview.invited_by?.first_name
                              ? ` · Invited by ${preview.invited_by.first_name}`
                              : ""}
                          </span>
                        </motion.div>
                      )}
                    </div>

                    <div className="mt-10 h-9">
                      {preview && !previewError && (
                        <motion.button
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          type="button"
                          onClick={handleJoin}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-fg)] px-5 py-2 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                        >
                          {busy ? "Joining…" : `Join ${preview.household.name}`}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
