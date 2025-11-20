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
  const isDarkMode = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [displayName, setDisplayName] = useState("You");
  const [profileUrl, setProfileUrl] = useState(null as string | null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  // Track pathname changes for animations
  useEffect(() => {
    if (pathname !== previousPathname) {
      setIsTransitioning(true);
      setPreviousPathname(pathname);
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, previousPathname]);

  const groups = useMemo(() => NAV_GROUPS, []);

  const onLogout = () => {
    if (isSigningOut) return;
    setShowLogout(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="h-16 shrink-0 flex items-center gap-3 px-4">
        {/* Reverted to img tag for reliability. Ensure logo.svg handles dark/light modes or use filters if needed. */}
        <img
          src="/logo.svg"
          alt="Zentari Logo"
          className="h-10 w-10 object-contain dark:invert"
        />
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)] font-sans">
          ZENTARI
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {groups.map((g) => (
          <div key={g.title} className="mt-3 first:mt-0">
            <div className="px-2 text-[11px] uppercase tracking-wider text-[var(--color-muted)]">{g.title}</div>
            <ul className="mt-2 space-y-1">
              {g.items.map((it) => {
                const active = pathname.startsWith(it.href);
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
                      aria-disabled={it.disabled || undefined}
                      className={clsx(
                        "group relative flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-all duration-200 ease-in-out",
                        it.disabled
                          ? "cursor-not-allowed text-[var(--color-muted)] opacity-70"
                          : !active && "hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] text-[var(--color-muted)]",
                        active && !it.disabled && "bg-[var(--color-sidebar-active)] text-[var(--color-fg)] font-medium"
                      )}
                    >
                      <motion.span 
                        className="flex items-center gap-2"
                        initial={false}
                        animate={active ? { 
                          scale: isTransitioning ? 0.98 : 1,
                          x: isTransitioning ? 2 : 0
                        } : { 
                          scale: 1,
                          x: 0
                        }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 25,
                          duration: 0.2
                        }}
                      >
                        <motion.span 
                          className={it.disabled ? "opacity-40" : undefined}
                          animate={active ? { 
                            scale: 1.05,
                            rotate: isTransitioning ? 5 : 0
                          } : { 
                            scale: 1,
                            rotate: 0
                          }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 400, 
                            damping: 20,
                            delay: 0.05
                          }}
                        >
                          {it.icon && <it.icon className="h-4 w-4" />}
                        </motion.span>
                        <motion.span 
                          className={it.disabled ? "text-[var(--color-muted)]" : undefined}
                          animate={active ? { 
                            x: isTransitioning ? 1 : 0
                          } : { 
                            x: 0
                          }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 25,
                            delay: 0.1
                          }}
                        >
                          {it.label}
                        </motion.span>
                      </motion.span>
                      {it.disabled && <FaLock className="h-3.5 w-3.5 text-[var(--color-muted)]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="my-3 h-px w-full bg-[var(--color-border)]" />
          </div>
        ))}
      </nav>
      <div className="p-3 pt-0">
        <div className="rounded-lg bg-[var(--color-surface)] p-3 border border-[var(--color-border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {profileUrl ? (
                <img src={profileUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[var(--color-muted)]/20" />
              )}
              <div className="text-sm font-medium text-[var(--color-fg)]">{displayName}</div>
            </div>
            <Button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2 rounded-[6px] text-[var(--color-fg)] hover:bg-[var(--color-bg)]"
            >
              <TbLogout className="h-4 w-4" />
            </Button>
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
    </div>
  );
}
