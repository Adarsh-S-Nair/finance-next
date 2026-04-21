"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { LuChevronsUpDown } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import { ConfirmOverlay } from "@zervo/ui";
import { createClient } from "@/lib/supabase/client";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
  initials: string;
};

/**
 * Pinned-to-bottom profile card. Click expands an options panel above the
 * trigger (currently only Sign out — Upgrade / Help are finance-only).
 * Sign-out uses a ConfirmOverlay, same pattern as apps/finance/ProfileBar.
 */
export default function AdminProfileBar({ name, email, avatarUrl, initials }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded]);

  const optionRowClass =
    "w-full flex items-center gap-2.5 px-5 py-2 text-[13px] transition-colors";

  return (
    <>
      <div
        ref={containerRef}
        className="fixed bottom-0 left-0 w-60 z-[60] border-t border-r border-[var(--color-fg)]/[0.06] bg-[var(--color-content-bg)]"
      >
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="admin-profile-options"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden border-b border-[var(--color-fg)]/[0.06]"
            >
              <div className="py-2">
                <button
                  onClick={() => {
                    setExpanded(false);
                    setShowLogoutConfirm(true);
                  }}
                  className={clsx(
                    optionRowClass,
                    "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                  )}
                >
                  <TbLogout className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>Log out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setExpanded((v) => !v)}
          className={clsx(
            "h-16 w-full flex items-center gap-3 px-5 text-left cursor-pointer group transition-colors",
            expanded ? "bg-[var(--color-fg)]/[0.04]" : "hover:bg-[var(--color-fg)]/[0.03]",
          )}
        >
          <div className="relative h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-semibold text-[var(--color-on-accent,white)] overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name ?? email ?? "User"} className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--color-fg)] truncate leading-tight">
              {name || "Admin"}
            </p>
            <p className="text-[11px] text-[var(--color-muted)] truncate leading-tight mt-0.5">
              {email || ""}
            </p>
          </div>

          <LuChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-muted)]/60 flex-shrink-0 group-hover:text-[var(--color-muted)]" />
        </button>
      </div>

      <ConfirmOverlay
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          try {
            setIsSigningOut(true);
            const supabase = createClient();
            await Promise.race([
              supabase.auth.signOut(),
              new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);
            if (typeof window !== "undefined") {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith("sb-")) localStorage.removeItem(key);
              }
            }
            window.location.href = "/auth";
          } finally {
            setIsSigningOut(false);
            setShowLogoutConfirm(false);
          }
        }}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        busyLabel="Signing out..."
        cancelLabel="Cancel"
        variant="primary"
        busy={isSigningOut}
      />
    </>
  );
}
