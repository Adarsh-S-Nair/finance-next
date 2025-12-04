"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { supabase } from "../lib/supabaseClient";
import { NAV_GROUPS } from "./nav";
import { FaLock } from "react-icons/fa";
import { TbLogout } from "react-icons/tb";
import { LuSettings, LuHeadphones } from "react-icons/lu";
import Button from "./ui/Button";
import ConfirmDialog from "./ui/ConfirmDialog";
import { useUser } from "./UserProvider";
import { motion } from "framer-motion";
import Tooltip from "./ui/Tooltip";

export default function SidebarContent({ onNavigate, isCollapsed }: { onNavigate?: () => void; isCollapsed?: boolean; toggle?: () => void; showToggle?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useUser();
  const [displayName, setDisplayName] = useState("You");
  const [email, setEmail] = useState("");
  const [profileUrl, setProfileUrl] = useState(null as string | null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        const first = (user.user_metadata?.first_name as string | undefined) || "";
        const last = (user.user_metadata?.last_name as string | undefined) || "";
        const composite = `${first} ${last}`.trim();
        const rawName = (user.user_metadata?.name as string | undefined)
          || (user.user_metadata?.full_name as string | undefined)
          || composite
          || "";
        const nonEmailName = /@/.test(rawName) ? "" : rawName;
        const fromEmail = (email?: string) => {
          if (!email) return "";
          const local = email.split("@")[0] || "";
          if (!local) return "";
          return local.charAt(0).toUpperCase() + local.slice(1);
        };
        const finalName = (nonEmailName && nonEmailName.trim()) || fromEmail(user.email) || "You";
        setDisplayName(finalName);
        setEmail(user.email || "");

        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=random&bold=true`;
        setProfileUrl(avatar);
      }
    };
    void load();
  }, []);

  const groups = useMemo(() => NAV_GROUPS, []);

  const onLogout = () => {
    if (isSigningOut) return;
    setShowLogout(true);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-content-bg)]">
      {/* Profile Section - Moved to Top */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <div
          className={`flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface)] transition-colors duration-200 cursor-default ${isCollapsed ? 'justify-center' : ''}`}
        >
          <div className="relative">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              {profileUrl ? (
                <img
                  src={profileUrl}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-[var(--color-border)]"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-neon-purple)] opacity-20" />
              )}
            </motion.div>
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
                {displayName}
              </div>
              <div className="text-xs text-[var(--color-muted)] truncate">
                {email}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation - Static, only hover/active animations */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {groups.map((g) => (
          <div
            key={g.title}
            className="mb-6 last:mb-0"
          >
            <div className={`px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-[var(--color-muted)] ${isCollapsed ? 'text-center' : ''}`}>
              {isCollapsed ? (
                <span className="block w-full border-b border-[var(--color-border)] my-2" />
              ) : (
                g.title
              )}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname.startsWith(it.href);
                const isHovered = hoveredItem === it.href;

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
                        "group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        it.disabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                        active
                          ? "text-[var(--color-fg)] bg-[var(--color-sidebar-active)]"
                          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
                      )}
                    >
                      {/* Enhanced active indicator - straight line */}
                      {active && (
                        <motion.div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--color-accent)]"
                          layoutId="activeIndicator"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}

                      <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
                        <motion.span
                          className="flex items-center justify-center"
                          animate={
                            active
                              ? { scale: 1.05 }
                              : isHovered
                                ? { scale: 1.1 }
                                : { scale: 1 }
                          }
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        >
                          {it.icon && <it.icon className="h-[18px] w-[18px]" />}
                        </motion.span>
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

      {/* Bottom Actions Section */}
      <div className="p-4 border-t border-[var(--color-border)] space-y-0.5">
        {/* Settings */}
        {isCollapsed ? (
          <Tooltip content="Settings">
            <Link
              href="/settings"
              onClick={() => onNavigate?.()}
              onMouseEnter={() => setHoveredItem('/settings')}
              onMouseLeave={() => setHoveredItem(null)}
              className={clsx(
                "group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                pathname.startsWith('/settings')
                  ? "text-[var(--color-fg)] bg-[var(--color-sidebar-active)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              )}
            >
              {pathname.startsWith('/settings') && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--color-accent)]"
                  layoutId="activeIndicator"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
                <motion.span
                  className="flex items-center justify-center"
                  animate={
                    pathname.startsWith('/settings')
                      ? { scale: 1.05 }
                      : hoveredItem === '/settings'
                        ? { scale: 1.1 }
                        : { scale: 1 }
                  }
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <LuSettings className="h-[18px] w-[18px]" />
                </motion.span>
                {!isCollapsed && <span className="tracking-wide">Settings</span>}
              </span>
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            onClick={() => onNavigate?.()}
            onMouseEnter={() => setHoveredItem('/settings')}
            onMouseLeave={() => setHoveredItem(null)}
            className={clsx(
              "group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
              pathname.startsWith('/settings')
                ? "text-[var(--color-fg)] bg-[var(--color-sidebar-active)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
            )}
          >
            {pathname.startsWith('/settings') && (
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--color-accent)]"
                layoutId="activeIndicator"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
              <motion.span
                className="flex items-center justify-center"
                animate={
                  pathname.startsWith('/settings')
                    ? { scale: 1.05 }
                    : hoveredItem === '/settings'
                      ? { scale: 1.1 }
                      : { scale: 1 }
                }
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <LuSettings className="h-[18px] w-[18px]" />
              </motion.span>
              {!isCollapsed && <span className="tracking-wide">Settings</span>}
            </span>
          </Link>
        )}

        {/* Help & Support (Locked) */}
        {isCollapsed ? (
          <Tooltip content="Help & Support">
            <div
              className="group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-not-allowed opacity-50 text-[var(--color-muted)]"
            >
              <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
                <span className="flex items-center justify-center">
                  <LuHeadphones className="h-[18px] w-[18px]" />
                </span>
                {!isCollapsed && <span className="tracking-wide">Help & Support</span>}
              </span>
              {!isCollapsed && <FaLock className="h-3 w-3 text-[var(--color-muted)] opacity-60" />}
            </div>
          </Tooltip>
        ) : (
          <div
            className="group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-not-allowed opacity-50 text-[var(--color-muted)]"
          >
            <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
              <span className="flex items-center justify-center">
                <LuHeadphones className="h-[18px] w-[18px]" />
              </span>
              {!isCollapsed && <span className="tracking-wide">Help & Support</span>}
            </span>
            {!isCollapsed && <FaLock className="h-3 w-3 text-[var(--color-muted)] opacity-60" />}
          </div>
        )}

        {/* Logout */}
        {isCollapsed ? (
          <Tooltip content="Log out">
            <button
              onClick={onLogout}
              onMouseEnter={() => setHoveredItem('logout')}
              onMouseLeave={() => setHoveredItem(null)}
              className="w-full group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
            >
              <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
                <motion.span
                  className="flex items-center justify-center"
                  animate={
                    hoveredItem === 'logout'
                      ? { scale: 1.1 }
                      : { scale: 1 }
                  }
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <TbLogout className="h-[18px] w-[18px]" />
                </motion.span>
                {!isCollapsed && <span className="tracking-wide">Log out</span>}
              </span>
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={onLogout}
            onMouseEnter={() => setHoveredItem('logout')}
            onMouseLeave={() => setHoveredItem(null)}
            className="w-full group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
          >
            <span className={`flex items-center gap-3 flex-1 ${isCollapsed ? 'justify-center' : ''}`}>
              <motion.span
                className="flex items-center justify-center"
                animate={
                  hoveredItem === 'logout'
                    ? { scale: 1.1 }
                    : { scale: 1 }
                }
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <TbLogout className="h-[18px] w-[18px]" />
              </motion.span>
              {!isCollapsed && <span className="tracking-wide">Log out</span>}
            </span>
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
      </div>
    </div>
  );
}
