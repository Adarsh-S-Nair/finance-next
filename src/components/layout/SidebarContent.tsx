"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { supabase } from "../../lib/supabase/client";
import { NAV_GROUPS } from "../nav";
import { FaLock } from "react-icons/fa";
import { LuSettings, LuHeadphones, LuSparkles, LuChevronsUpDown } from "react-icons/lu";
import { TbLogout } from "react-icons/tb";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useUser } from "../providers/UserProvider";
import { Tooltip } from "@slate-ui/react";
import { isFeatureEnabled } from "../../lib/tierConfigClient";
import UpgradeOverlay from "../UpgradeOverlay";
import SidebarSection from "./SidebarSection";
import SidebarItem from "./SidebarItem";

export default function SidebarContent({ onNavigate, isCollapsed }: { onNavigate?: () => void; isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout, user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
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

  // Computed user display values
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
  const avatarUrl = profile?.avatar_url || meta.avatar_url || meta.picture || null;

  return (
    <div className="flex h-full flex-col bg-[var(--color-sidebar-bg)]">
      {/* Navigation */}
      <nav className={clsx("flex-1 overflow-y-auto scrollbar-thin pt-5", isCollapsed ? "px-2" : "px-3")}>
        {groups.map((g, i) => (
          <React.Fragment key={g.title ?? `group-${i}`}>
            <SidebarSection label={g.title} isCollapsed={isCollapsed}>
              {g.items.map((it) => (
                <SidebarItem
                  key={it.href}
                  href={it.href}
                  label={it.label}
                  icon={it.icon}
                  active={pathname.startsWith(it.href)}
                  disabled={it.disabled}
                  isCollapsed={isCollapsed}
                  onClick={onNavigate}
                />
              ))}
            </SidebarSection>
          </React.Fragment>
        ))}
      </nav>

      {/* User Section */}
      <div className={clsx("flex-shrink-0 border-t border-[var(--color-fg)]/[0.06]", isCollapsed ? "p-2 pb-3" : "p-3 pb-4")}>
        {/* Slide-up menu — expanded */}
        {showPopover && !isCollapsed && (
          <div>
            {tier === "free" && (
              <button
                onClick={() => { setShowPopover(false); setShowUpgradeOverlay(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
              >
                <LuSparkles className="h-[18px] w-[18px] flex-shrink-0" />
                <span>Upgrade to Pro</span>
              </button>
            )}

            <Link
              href="/settings"
              onClick={() => { setShowPopover(false); onNavigate?.(); }}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 text-[13px]",
                pathname.startsWith("/settings")
                  ? "text-[var(--color-fg)] font-medium bg-[var(--color-fg)]/[0.08]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]"
              )}
            >
              <LuSettings className="h-[18px] w-[18px] flex-shrink-0" />
              <span>Settings</span>
            </Link>

            <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-muted)] opacity-40 cursor-not-allowed">
              <LuHeadphones className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="flex-1">Help &amp; Support</span>
              <FaLock className="h-3 w-3 opacity-60" />
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05] mb-1"
            >
              <TbLogout className="h-[18px] w-[18px] flex-shrink-0" />
              <span>Log out</span>
            </button>
          </div>
        )}

        {/* Slide-up menu — collapsed */}
        {showPopover && isCollapsed && (
          <div className="flex flex-col mb-1">
            {tier === "free" && (
              <Tooltip content="Upgrade to Pro">
                <button
                  onClick={() => { setShowPopover(false); setShowUpgradeOverlay(true); }}
                  className="w-full flex items-center justify-center px-2 py-2 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                >
                  <LuSparkles className="h-[18px] w-[18px]" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Settings">
              <Link
                href="/settings"
                onClick={() => { setShowPopover(false); onNavigate?.(); }}
                className={clsx(
                  "w-full flex items-center justify-center px-2 py-2",
                  pathname.startsWith("/settings")
                    ? "text-[var(--color-fg)] bg-[var(--color-fg)]/[0.08]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]"
                )}
              >
                <LuSettings className="h-[18px] w-[18px]" />
              </Link>
            </Tooltip>
            <Tooltip content="Log out">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center px-2 py-2 text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-fg)]/[0.05]"
              >
                <TbLogout className="h-[18px] w-[18px]" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Profile trigger */}
        {isCollapsed ? (
          <Tooltip content={fullName || "Profile"}>
            <button
              ref={triggerRef}
              onClick={() => setShowPopover((v) => !v)}
              className="w-full flex items-center justify-center p-2 hover:bg-[var(--color-fg)]/[0.05] cursor-pointer"
            >
              <div className="relative h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-semibold text-[var(--color-on-accent)] flex-shrink-0 overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </button>
          </Tooltip>
        ) : (
          <button
            ref={triggerRef}
            onClick={() => setShowPopover((v) => !v)}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer group",
              showPopover
                ? "bg-[var(--color-fg)]/[0.08]"
                : "hover:bg-[var(--color-fg)]/[0.05]"
            )}
          >
            {/* Avatar */}
            <div className="relative h-8 w-8 rounded-full flex-shrink-0">
              <div className="h-full w-full rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-semibold text-[var(--color-on-accent)] overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-fg)] truncate leading-none">
                {fullName || "User"}
              </p>
            </div>

            <LuChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-muted)]/40 flex-shrink-0 group-hover:text-[var(--color-muted)]/70" />
          </button>
        )}

        <ConfirmDialog
          isOpen={showLogout}
          onCancel={() => setShowLogout(false)}
          onConfirm={async () => {
            try {
              setIsSigningOut(true);
              await Promise.race([
                supabase.auth.signOut(),
                new Promise((resolve) => setTimeout(resolve, 3000)),
              ]);
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
