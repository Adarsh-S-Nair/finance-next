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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);


  const groups = useMemo(() => NAV_GROUPS, []);

  const onLogout = () => {
    if (isSigningOut) return;
    setShowLogout(true);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-content-bg)]">
      {/* Profile Section - Moved to Top */}
      {/* Logo Section */}
      <div className="p-4 flex items-center justify-center h-16">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <motion.div
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
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          />
          {!isCollapsed && (
            <h1 className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase" style={{ fontFamily: 'var(--font-poppins)' }}>
              ZENTARI
            </h1>
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
