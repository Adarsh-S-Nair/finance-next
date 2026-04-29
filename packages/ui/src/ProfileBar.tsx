"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { LuChevronsUpDown } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import ConfirmOverlay from "./ConfirmOverlay";

/**
 * Standard option-row class for ProfileBar children. Compose with state
 * colors (active/hover/disabled) per consumer.
 */
export const PROFILE_BAR_ITEM_CLASS =
  "w-full flex items-center gap-2.5 px-5 py-2 text-[13px] transition-colors";

const DEFAULT_CONTAINER_CLASS =
  "fixed bottom-0 left-0 w-60 z-[60] border-t border-[var(--color-fg)]/[0.06] bg-[var(--color-content-bg)]";

const DEFAULT_INFO_CLASS = "flex-1 min-w-0";
const DEFAULT_CHEVRON_CLASS =
  "h-3.5 w-3.5 text-[var(--color-muted)]/60 flex-shrink-0 group-hover:text-[var(--color-muted)]";

export type ProfileBarChildrenApi = {
  /** Close the dropdown panel. Use from buttons that don't navigate
   *  (e.g. opening a modal) — links auto-close via the pathname effect. */
  close: () => void;
};

export type ProfileBarProps = {
  name: string | null;
  subtitle?: string | null;
  avatarUrl?: string | null;
  initials: string;

  /** Custom items rendered above the built-in Sign out row. Use
   *  PROFILE_BAR_ITEM_CLASS on each item for consistent layout. */
  children?: ReactNode | ((api: ProfileBarChildrenApi) => ReactNode);

  /** Async sign-out work (e.g. supabase.auth.signOut). Raced against a
   *  3s timeout so a stuck network call doesn't trap the UI. */
  signOut: () => Promise<void> | void;

  /** Sync post-cleanup action (router.replace, window.location.href). Runs
   *  after localStorage `sb-*` keys are cleared. */
  onSignedOut: () => void;

  /** Custom label for the Sign out menu item — useful when the caller
   *  needs the label to collapse responsively (`hidden xl:inline`). */
  signOutLabel?: ReactNode;

  /** Outer wrapper className — fully replaces the default. */
  containerClassName?: string;
  /** Class on the trigger info column (name + subtitle). */
  infoClassName?: string;
  /** Class on the trigger chevron icon. */
  chevronClassName?: string;
};

export default function ProfileBar({
  name,
  subtitle,
  avatarUrl,
  initials,
  children,
  signOut,
  onSignedOut,
  signOutLabel = "Log out",
  containerClassName,
  infoClassName,
  chevronClassName,
}: ProfileBarProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Auto-collapse on navigation so link clicks close the panel without
  // each item needing its own onClick.
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

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
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded]);

  const close = () => setExpanded(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      // Race the supabase signOut against a 3s ceiling — a hung network
      // call shouldn't trap the user; we'll proceed with cleanup anyway.
      await Promise.race([
        Promise.resolve(signOut()),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (typeof window !== "undefined") {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-")) localStorage.removeItem(key);
        }
      }
      onSignedOut();
    } finally {
      setIsSigningOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const renderedChildren =
    typeof children === "function" ? children({ close }) : children;

  return (
    <>
      <div
        ref={containerRef}
        className={containerClassName ?? DEFAULT_CONTAINER_CLASS}
      >
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="profile-bar-options"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden border-b border-[var(--color-fg)]/[0.06]"
            >
              <div className="py-2">
                {renderedChildren}
                <button
                  onClick={() => {
                    setExpanded(false);
                    setShowLogoutConfirm(true);
                  }}
                  className={clsx(
                    PROFILE_BAR_ITEM_CLASS,
                    "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                  )}
                >
                  <TbLogout className="h-[18px] w-[18px] flex-shrink-0" />
                  {typeof signOutLabel === "string" ? (
                    <span>{signOutLabel}</span>
                  ) : (
                    signOutLabel
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setExpanded((v) => !v)}
          className={clsx(
            "h-16 w-full flex items-center gap-3 px-5 text-left cursor-pointer group transition-colors",
            expanded
              ? "bg-[var(--color-fg)]/[0.04]"
              : "hover:bg-[var(--color-fg)]/[0.03]",
          )}
        >
          <div className="relative h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-semibold text-[var(--color-on-accent,white)] overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name ?? "User"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className={infoClassName ?? DEFAULT_INFO_CLASS}>
            <p className="text-[13px] font-medium text-[var(--color-fg)] truncate leading-tight">
              {name || "User"}
            </p>
            {subtitle ? (
              <p className="text-[11px] text-[var(--color-muted)] truncate leading-tight mt-0.5">
                {subtitle}
              </p>
            ) : null}
          </div>

          <LuChevronsUpDown
            className={chevronClassName ?? DEFAULT_CHEVRON_CLASS}
          />
        </button>
      </div>

      <ConfirmOverlay
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleSignOut}
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
