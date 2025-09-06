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
// Logo is served from public for reliable URL-based masking

export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useUser();
  const accentHex = profile?.accent_color ?? null;
  const hasAccent = !!accentHex;
  const [displayName, setDisplayName] = useState("You");
  const [profileUrl, setProfileUrl] = useState(null as string | null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

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
    <div className="flex h-full flex-col">
      <div className="h-16 shrink-0 flex items-center gap-3 px-4">
        <span
          aria-hidden
          className="h-16 w-16 inline-block bg-[var(--color-accent)] flex-shrink-0"
          style={{
            WebkitMaskImage: "url(/logo.svg)",
            maskImage: "url(/logo.svg)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)] font-sans">
          ZENTARI
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
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
                        "group relative flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm",
                        it.disabled
                          ? "cursor-not-allowed text-[color-mix(in_oklab,var(--color-muted),var(--color-bg)_40%)] opacity-70"
                          : "hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]",
                        active && !it.disabled && (hasAccent
                          ? "bg-[color-mix(in_oklab,var(--color-accent),transparent_94%)] text-[var(--color-accent)]"
                          : "bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] text-[var(--color-fg)]")
                      )}
                    >
                      {active && hasAccent && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-accent)]"
                        />
                      )}
                      <span className="flex items-center gap-2">
                        <span className={it.disabled ? "opacity-40" : undefined}>{it.icon && <it.icon className="h-4 w-4" />}</span>
                        <span className={it.disabled ? "text-[color-mix(in_oklab,var(--color-muted),var(--color-bg)_40%)]" : undefined}>{it.label}</span>
                      </span>
                      {it.disabled && <FaLock className="h-3.5 w-3.5 text-[color-mix(in_oklab,var(--color-muted),var(--color-bg)_40%)]" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="my-3 h-px w-full bg-[color-mix(in_oklab,var(--color-fg),transparent_92%)]" />
          </div>
        ))}
      </nav>
      <div className="p-3 pt-0">
        <div className="rounded-lg bg-[color-mix(in_oklab,var(--color-fg),transparent_96%)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {profileUrl ? (
                <img src={profileUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)]" />
              )}
              <div className="text-sm font-medium">{displayName}</div>
            </div>
            <Button
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2 rounded-[6px] text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]"
            >
              <TbLogout className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              isOpen={showLogout}
              onCancel={() => setShowLogout(false)}
              onConfirm={async () => {
                try {
                  setIsSigningOut(true);
                  logout(); // Reset theme and accent immediately
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


