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
import Button from "./ui/Button";
import ConfirmDialog from "./ui/ConfirmDialog";
import { useUser } from "./UserProvider";
import { motion } from "framer-motion";

export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useUser();
  const [displayName, setDisplayName] = useState("You");
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
      {/* Header - Static, no entrance animation */}
      <div
        className="h-20 shrink-0 flex items-center gap-3 px-6 border-b border-[var(--color-border)]"
      >
        <motion.img
          src="/logo.svg"
          alt="Zentari Logo"
          className="h-9 w-9 object-contain dark:invert"
          whileHover={{ scale: 1.05, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        />
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)] font-sans">
          Zentari
        </h1>
      </div>

      {/* Navigation - Static, only hover/active animations */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {groups.map((g) => (
          <div
            key={g.title}
            className="mb-6 last:mb-0"
          >
            <div className="px-3 mb-2 text-[10px] uppercase tracking-widest font-semibold text-[var(--color-muted)]">
              {g.title}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname.startsWith(it.href);
                const isHovered = hoveredItem === it.href;

                return (
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
                        "group relative flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
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

                      <span className="flex items-center gap-3 flex-1">
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
                        <span className="tracking-wide">
                          {it.label}
                        </span>
                      </span>

                      {it.disabled && (
                        <FaLock className="h-3 w-3 text-[var(--color-muted)] opacity-60" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Profile Section - Static */}
      <div
        className="p-4 border-t border-[var(--color-border)]"
      >
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface)] p-3 border border-[var(--color-border)] hover:border-[var(--color-muted)]/30 transition-all duration-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              {profileUrl ? (
                <img
                  src={profileUrl}
                  alt="Profile"
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-[var(--color-border)]"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-neon-purple)] opacity-20" />
              )}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
                {displayName}
              </div>
              <div className="text-xs text-[var(--color-muted)] truncate">
                Account
              </div>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              variant="ghost"
              size="sm"
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg)] transition-all duration-200"
            >
              <TbLogout className="h-[18px] w-[18px]" />
            </Button>
          </motion.div>

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
    </div>
  );
}
