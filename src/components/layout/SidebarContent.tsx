"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { supabase } from "../../lib/supabase/client";
import { NAV_GROUPS } from "../nav";
import { FaLock } from "react-icons/fa";
import { TbLogout } from "react-icons/tb";
import { LuSettings, LuHeadphones } from "react-icons/lu";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useUser } from "../providers/UserProvider";
import { motion, AnimatePresence } from "framer-motion";
import Tooltip from "../ui/Tooltip";
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
  const popoverRef = useRef<HTMLDivElement>(null);
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

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  // Close popover on Escape
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
  const avatarUrl = profile?.avatar_url;

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
    <div className="flex h-full flex-col bg-[var(--color-content-bg)]">
      {/* Logo Section */}
      <div className="p-4 flex items-center justify-center h-16">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div
            className="h-8 w-8 bg-[var(--color-fg)]"
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
              <h1 className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase" style={{ fontFamily: 'var(--font-poppins)' }}>
                ZENTARI
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
        {groups.map((g) => (
          <div
            key={g.title}
            className="mb-6 last:mb-0"
          >
            <div className={`px-3 mb-2 text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider ${isCollapsed ? 'text-center' : ''}`}>
              {isCollapsed ? (
                <span className="block w-full border-b border-[var(--color-border)] my-2" />
              ) : (
                g.title
              )}
            </div>
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
                        "group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-normal transition-all duration-200",
                        it.disabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                        active
                          ? "text-[var(--color-fg)] bg-[var(--color-sidebar-active)]"
                          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
                      )}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-accent)] rounded-r-md"
                        />
                      )}

                      <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
                        <span className="flex items-center justify-center">
                          {it.icon && <it.icon className="h-[18px] w-[18px]" />}
                        </span>
                        {!isCollapsed && (
                          <span className="tracking-wide">
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
      <div className="p-4 pb-5 border-t border-[var(--color-border)] relative">
        {/* Popover Menu — opens to the right */}
        <AnimatePresence>
          {showPopover && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden z-[60]"
              style={{
                left: isCollapsed ? "calc(5rem + 8px)" : "calc(16rem + 8px)",
                bottom: "16px",
                minWidth: "200px",
              }}
            >
              {/* Settings */}
              <Link
                href="/settings"
                onClick={() => { setShowPopover(false); onNavigate?.(); }}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-150",
                  pathname.startsWith("/settings")
                    ? "text-[var(--color-fg)] bg-[var(--color-sidebar-active)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-white/5"
                )}
              >
                <LuSettings className="h-4 w-4 flex-shrink-0" />
                <span>Settings</span>
              </Link>

              {/* Help & Support (locked) */}
              <div className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-muted)] opacity-50 cursor-not-allowed">
                <LuHeadphones className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">Help &amp; Support</span>
                <FaLock className="h-3 w-3 opacity-60" />
              </div>

              <div className="border-t border-[var(--color-border)]" />

              {/* Log out */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-white/5 transition-colors duration-150"
              >
                <TbLogout className="h-4 w-4 flex-shrink-0" />
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
              className="w-full flex items-center justify-center rounded-lg p-2 transition-colors duration-200 hover:bg-[var(--color-surface)] group cursor-pointer"
            >
              {avatarEl}
            </button>
          </Tooltip>
        ) : (
          <button
            ref={triggerRef}
            onClick={() => setShowPopover((v) => !v)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-[var(--color-surface)] group text-left cursor-pointer"
          >
            {avatarEl}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-[var(--color-fg)] truncate leading-tight">
                  {fullName || "User"}
                </p>
                <span
                  className={clsx(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0",
                    tier === "pro"
                      ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                      : "bg-white/10 text-[var(--color-muted)]"
                  )}
                >
                  {tierLabel}
                </span>
              </div>
              {tier === "free" && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setShowUpgradeOverlay(true); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setShowUpgradeOverlay(true); } }}
                  className="text-[10px] text-[var(--color-accent)] hover:opacity-80 transition-opacity mt-0.5 cursor-pointer"
                >
                  Upgrade
                </span>
              )}
            </div>
            <svg
              className={clsx(
                "h-3.5 w-3.5 text-[var(--color-muted)] transition-transform duration-200 flex-shrink-0",
                showPopover && "rotate-180"
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <ConfirmDialog
          isOpen={showLogout}
          onCancel={() => setShowLogout(false)}
          onConfirm={async () => {
            try {
              setIsSigningOut(true);
              logout();
              await supabase.auth.signOut();
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
