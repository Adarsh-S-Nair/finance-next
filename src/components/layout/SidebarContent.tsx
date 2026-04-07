"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { supabase } from "../../lib/supabase/client";
import { NAV_GROUPS } from "../nav";
import { FaLock } from "react-icons/fa";
import { LuSettings, LuHeadphones } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useUser } from "../providers/UserProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "@slate-ui/react";
import { isFeatureEnabled } from "../../lib/tierConfigClient";
import UpgradeOverlay from "../UpgradeOverlay";

export default function SidebarContent({ onNavigate, isCollapsed }: { onNavigate?: () => void; isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout, user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => {
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, []);

  const onLogout = () => {
    if (isSigningOut) return;
    setShowPopover(false);
    setShowLogout(true);
  };

  // Close panel on Escape
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPopover(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showPopover]);

  // Close popover on navigation
  useEffect(() => {
    setShowPopover(false);
  }, [pathname]);

  // Computed user display values — profile row may be empty, fall back to user_metadata from auth
  const meta = (user as any)?.user_metadata ?? {};
  const firstName = profile?.first_name || meta.first_name || "";
  const lastName = profile?.last_name || meta.last_name || "";
  const rawName = [firstName, lastName].filter(Boolean).join(" ")
    || meta.name
    || meta.full_name
    || "";
  const fullName = rawName
    ? rawName.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : user?.email || "";
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : firstName
    ? firstName[0].toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";
  const tier = profile?.subscription_tier ?? "free";
  const tierLabel = tier === "pro" ? "Pro" : "Free";
  const avatarUrl = profile?.avatar_url || meta.avatar_url || meta.picture || null;

  const avatarEl = (
    <div
      className="relative h-9 w-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 overflow-hidden"
      style={{ fontSize: "0.75rem" }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Logo Section */}
      <div className="p-4 flex items-center justify-center h-16">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div
            className="h-7 w-7 bg-[var(--color-fg)]"
            style={{
              maskImage: 'url(/logo.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/logo.svg)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center'
            }}
          />
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-semibold tracking-[0.2em] text-[var(--color-fg)] uppercase" style={{ fontFamily: 'var(--font-poppins)' }}>
                ZERVO
              </h1>
              {process.env.NEXT_PUBLIC_PLAID_ENV === 'mock' && (
                <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10 leading-none">
                  TEST
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {groups.map((g, idx) => (
          <div
            key={g.title}
            className="mb-4 last:mb-0"
          >
            {idx > 0 && (
              <div className="border-t border-[var(--color-border)]/60 mb-4" />
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname.startsWith(it.href);

                const content = (
                  <li key={it.href}>
                    <Link
                      href={it.disabled ? "#" : it.href}
                      onClick={(e) => {
                        if (it.disabled) {
                          e.preventDefault();
                          return;
                        }
                        onNavigate?.();
                      }}
                      onMouseEnter={() => !it.disabled && setHoveredItem(it.href)}
                      onMouseLeave={() => setHoveredItem(null)}
                      aria-disabled={it.disabled || undefined}
                      className={clsx(
                        "group relative flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-200",
                        it.disabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                        active
                          ? "text-[var(--color-fg)] font-medium bg-[var(--color-sidebar-active)]"
                          : "text-[var(--color-fg)]/60 font-normal hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]"
                      )}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-md"
                        />
                      )}

                      <span className={`flex items-center gap-2.5 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
                        <span className="flex items-center justify-center">
                          {it.icon && <it.icon className="h-[18px] w-[18px]" />}
                        </span>
                        {!isCollapsed && (
                          <span className="tracking-normal">
                            {it.label}
                          </span>
                        )}
                      </span>

                      {it.disabled && (
                        <FaLock className="h-3 w-3 text-[var(--color-muted)] opacity-60" />
                      )}
                    </Link>
                  </li>
                );

                return isCollapsed ? (
                  <Tooltip key={it.href} content={it.label}>
                    {content}
                  </Tooltip>
                ) : content;
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile Card / Bottom Section */}
      <div className="p-3 pb-4 border-t border-[var(--color-border)]">
        {/* Inline slide-up menu — expands above profile button */}
        <AnimatePresence>
          {showPopover && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              style={{ overflow: "hidden" }}
            >
              {/* Settings */}
              <Link
                href="/settings"
                onClick={() => { setShowPopover(false); onNavigate?.(); }}
                className={clsx(
                  "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-colors duration-150",
                  pathname.startsWith("/settings")
                    ? "text-[var(--color-fg)] font-medium bg-[var(--color-sidebar-active)]"
                    : "text-[var(--color-fg)]/60 hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]"
                )}
              >
                <LuSettings className="h-[18px] w-[18px] flex-shrink-0" />
                <span>Settings</span>
              </Link>

              {/* Help & Support (locked) */}
              <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-muted)] opacity-50 cursor-not-allowed rounded-lg">
                <LuHeadphones className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="flex-1">Help &amp; Support</span>
                <FaLock className="h-3 w-3 opacity-60" />
              </div>

              {/* Log out */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-fg)]/60 hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors duration-150 rounded-lg mb-1"
              >
                <TbLogout className="h-[18px] w-[18px] flex-shrink-0" />
                <span>Log out</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile trigger button */}
        {isCollapsed ? (
          <Tooltip content={fullName || "Profile"}>
            <button
              ref={triggerRef}
              onClick={() => setShowPopover((v) => !v)}
              className="w-full flex items-center justify-center rounded-xl p-2.5 transition-colors duration-200 hover:bg-[var(--color-surface-alt)] cursor-pointer"
            >
              {avatarEl}
            </button>
          </Tooltip>
        ) : (
          <button
            ref={triggerRef}
            onClick={() => setShowPopover((v) => !v)}
            className={clsx(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 text-left cursor-pointer group",
              showPopover
                ? "bg-[var(--color-surface)]"
                : "hover:bg-[var(--color-surface-alt)]"
            )}
          >
            {/* Avatar with ring on open */}
            <div className={clsx(
              "relative h-9 w-9 rounded-full flex-shrink-0 ring-2 transition-all duration-200",
              showPopover ? "ring-[var(--color-accent)]/50" : "ring-transparent"
            )}>
              <div className="h-full w-full rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <p className="text-sm font-medium text-[var(--color-fg)] truncate">
                  {fullName || "User"}
                </p>
                <span
                  className={clsx(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none tracking-wide uppercase flex-shrink-0",
                    tier === "pro"
                      ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30"
                      : "bg-white/8 text-[var(--color-muted)]/70 border border-white/10"
                  )}
                >
                  {tierLabel}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-muted)]/60 mt-0.5 truncate leading-none">
                {tier === "free" ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setShowUpgradeOverlay(true); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setShowUpgradeOverlay(true); } }}
                    className="text-[var(--color-accent)]/70 hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                  >
                    Upgrade to Pro
                  </span>
                ) : (
                  user?.email || ""
                )}
              </p>
            </div>

            <svg
              className="h-3.5 w-3.5 text-[var(--color-muted)]/60 flex-shrink-0 transition-colors duration-200 group-hover:text-[var(--color-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {showPopover ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7-7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7 7 7-7" />
              )}
            </svg>
          </button>
        )}

        <ConfirmDialog
          isOpen={showLogout}
          onCancel={() => setShowLogout(false)}
          onConfirm={async () => {
            try {
              setIsSigningOut(true);
              // signOut can hang if Supabase's internal auth lock is held — add timeout
              await Promise.race([
                supabase.auth.signOut(),
                new Promise((resolve) => setTimeout(resolve, 3000)),
              ]);
              // Clear localStorage auth data manually in case signOut didn't complete
              if (typeof window !== 'undefined') {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith('sb-')) localStorage.removeItem(key);
                }
              }
              logout();
              onNavigate?.();
              router.replace("/");
            } finally {
              setIsSigningOut(false);
              setShowLogout(false);
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
      </div>
    </div>
  );
}
