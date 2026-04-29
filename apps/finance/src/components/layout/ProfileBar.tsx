"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { FaLock } from "react-icons/fa";
import { LuSettings, LuHeadphones, LuSparkles, LuChevronsUpDown } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import UpgradeOverlay from "../UpgradeOverlay";
import { ConfirmOverlay } from "@zervo/ui";

/**
 * Floating profile card pinned to the bottom-left, spanning the household
 * rail and the main sidebar. Clicking the card animates an options panel
 * open inside the same pill — Upgrade / Settings / Help / Log out stack
 * above the trigger and overlay both columns.
 */
export default function ProfileBar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, logout } = useUser();

  const [expanded, setExpanded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  const meta = (user as unknown as { user_metadata?: Record<string, unknown> })?.user_metadata ?? {};
  const firstName = profile?.first_name || (meta.first_name as string | undefined) || "";
  const lastName = profile?.last_name || (meta.last_name as string | undefined) || "";
  const rawName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    (meta.name as string | undefined) ||
    (meta.full_name as string | undefined) ||
    "";
  const fullName = rawName
    ? rawName
        .trim()
        .split(/\s+/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : user?.email || "";
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : firstName
        ? firstName[0].toUpperCase()
        : user?.email?.[0]?.toUpperCase() ?? "?";
  const tier = profile?.subscription_tier ?? "free";
  const avatarUrl =
    profile?.avatar_url ||
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    null;

  const onLogout = () => {
    if (isSigningOut) return;
    setExpanded(false);
    setShowLogoutConfirm(true);
  };

  const optionRowClass =
    "w-full flex items-center gap-2.5 px-5 py-2 text-[13px] transition-colors";

  return (
    <>
      <div
        ref={containerRef}
        className="hidden md:flex flex-col fixed bottom-0 left-0 md:w-20 xl:w-60 z-[60] border-t border-[var(--color-fg)]/[0.06] bg-[var(--color-shell-bg)]"
      >
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="profile-options"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden border-b border-[var(--color-fg)]/[0.06]"
            >
              <div className="py-2">
                {tier === "free" && (
                  <button
                    onClick={() => {
                      setExpanded(false);
                      setShowUpgradeOverlay(true);
                    }}
                    className={clsx(
                      optionRowClass,
                      "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10",
                    )}
                  >
                    <LuSparkles className="h-[18px] w-[18px] flex-shrink-0" />
                    <span className="hidden xl:inline">Upgrade to Pro</span>
                  </button>
                )}

                <Link
                  href="/settings"
                  onClick={() => {
                    setExpanded(false);
                    onNavigate?.();
                  }}
                  className={clsx(
                    optionRowClass,
                    pathname.startsWith("/settings")
                      ? "text-[var(--color-fg)] font-medium bg-[var(--color-fg)]/[0.08]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                  )}
                >
                  <LuSettings className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="hidden xl:inline">Settings</span>
                </Link>

                <div
                  className={clsx(
                    optionRowClass,
                    "text-[var(--color-muted)] opacity-40 cursor-not-allowed",
                  )}
                >
                  <LuHeadphones className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="hidden xl:inline flex-1">Help &amp; Support</span>
                  <FaLock className="h-3 w-3 opacity-60 hidden xl:block" />
                </div>

                <button
                  onClick={onLogout}
                  className={clsx(
                    optionRowClass,
                    "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]",
                  )}
                >
                  <TbLogout className="h-[18px] w-[18px] flex-shrink-0" />
                  <span className="hidden xl:inline">Log out</span>
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

              <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0 hidden xl:block">
            <p className="text-[13px] font-medium text-[var(--color-fg)] truncate leading-tight">
              {fullName || "User"}
            </p>
            <p className="text-[11px] text-[var(--color-muted)] truncate leading-tight mt-0.5">
              {tier === "pro" ? "Pro" : "Free"}
            </p>
          </div>

          <LuChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-muted)]/60 flex-shrink-0 hidden xl:block group-hover:text-[var(--color-muted)]" />
        </button>
      </div>

      <ConfirmOverlay
        isOpen={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          try {
            setIsSigningOut(true);
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
            logout();
            onNavigate?.();
            router.replace("/");
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
      <UpgradeOverlay isOpen={showUpgradeOverlay} onClose={() => setShowUpgradeOverlay(false)} />
    </>
  );
}
